import {
  elizaLogger,
  composeContext,
  generateObject,
  ModelClass,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  Content,
} from "@elizaos/core";
import { Address, beginCell, internal, toNano } from "@ton/core";
import { z } from "zod";
import { initWalletProvider, WalletProvider } from "../providers/wallet";
import { uploadFolderToIPFS, updateMetadataFiles, uploadJSONToIPFS, base64ToHex, waitSeqno } from "../utils/util";

/**
 * Extended interface for NFT metadata update content.
 * - nftAddress: The target NFT smart contract address.
 * - metadata: Partial NFT metadata update. All fields are optional, supporting partial edits.
 *   * storage: Option for metadata storage ("on-chain" or "off-chain").
 *   * ipfsProvider: Optional field (deprecated in favor of helia for off-chain uploads).
 * Additionally, for on-chain updates, optional fields below enable crafting the new on-chain content:
 * - newCollectionMeta: The new collection metadata URL.
 * - newNftCommonMeta: The new NFT common metadata URL.
 * - royaltyAddress: The address to receive royalties.
 */
export interface UpdateNFTMetadataContent extends Content {
  nftAddress: string;
  storage: "prompt" | "file";
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    content_url?: string;
    attributes?: any[];
  };
  newCollectionMeta?: string;
  newNftCommonMeta?: string;
  royaltyPercent?: number;
  royaltyAddress?: string;
}

/**
 * Define schema for updating NFT metadata.
 */
const updateNFTMetadataSchema = z.object({
  nftAddress: z.string().nonempty({ message: "NFT address is required" }),
  storage: z.enum(["prompt", "file"]).default("prompt"),
  metadata: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    content_url: z.string().optional(),
    attributes: z.array(z.any()).optional(),
  }),
  // New fields for on-chain update via custom message:
  newCollectionMeta: z.string().optional(),
  newNftCommonMeta: z.string().optional(),
  royaltyAddress: z.string().optional(),
});


const updateNFTMetadataTemplate = `Respond with a JSON markdown block containing only the extracted values.
Example response for NFT with metadata in prompt  :
\`\`\`json
    "collection": "EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4",
    "owner": "EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4",
    "storage": "prompt",
    "royaltyPercent": 0.05,
    "royaltyAddress": "EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4"
    "metadata": {
        "name": "Rare NFT Artwork",
        "description": "A unique NFT artwork minted on TON",
        "image": "https://example.com/nft-image.png",
    }
}
\`\`\`

Example response for collection NFT (new collection):
\`\`\`json
{
    "collection": "EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4",
    "owner": "EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4",
    "storage": "file",
    "imagesFolderPath": "path/to/images",
    "metadataFolderPath": "path/to/metadata",
    "royaltyPercent": 0.05,
    "royaltyAddress": "EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4"
}
\`\`\`

{{recentMessages}}

Extract and output only the values as a JSON markdown block.`;

function isUpdateNFTMetadataContent(content: UpdateNFTMetadataContent): boolean {
  return (
    typeof content.nftAddress === "string" &&
    typeof content.storage === "string" &&
    typeof content.metadata === "object" &&
    typeof content.newCollectionMeta === "string" &&
    typeof content.newNftCommonMeta === "string" &&
    typeof content.royaltyAddress === "string" &&
    typeof content.royaltyPercent === "number" &&
    ((content.storage === "file" && content.imagesFolderPath && content.metadataFolderPath) || (content.storage === "prompt" && content.metadata)) 
  ) as boolean;
}
 

/**
 * Builds the update details by composing the context using the updateNFTMetadataTemplate
 * and generating the desired object using the provided schema.
 */
const buildUpdateDetails = async (
  runtime: IAgentRuntime,
  message: Memory,
  state: State
): Promise<UpdateNFTMetadataContent> => {
  const updateContext = composeContext({
    state,
    template: updateNFTMetadataTemplate,
  });

  const content = await generateObject({
    runtime,
    context: updateContext,
    schema: updateNFTMetadataSchema,
    modelClass: ModelClass.SMALL,
  });

  return content.object as UpdateNFTMetadataContent;
};

/**
 * Crafts and sends an on-chain update transaction that changes the NFT's content.
 * The message follows the provided example:
 * - Opcode 4 indicates a "change content" operation.
 * - The message body stores a reference to a content cell (built from the new collection meta and NFT common meta)
 *   and a royalty cell.
 */
async function updateNFTMetadataOnChain(
  params: UpdateNFTMetadataContent
): Promise<string> {
  // Parse the NFT address.
  const nftTonAddress = Address.parse(params.nftAddress);

  // Build the collection metadata cell.
  const collectionMetaCell = beginCell()
    .storeUint(1, 8) // Indicates offchain metadata.
    .storeStringTail(params.newCollectionMeta)
    .endCell();

  // Build the NFT common metadata cell.
  const nftCommonMetaCell = beginCell()
    .storeUint(1, 8)
    .storeStringTail(params.newNftCommonMeta)
    .endCell();

  // Build the content cell which contains both references.
  const contentCell = beginCell()
    .storeRef(collectionMetaCell)
    .storeRef(nftCommonMetaCell)
    .endCell();

  // Build the royalty cell.
  const royaltyCell = beginCell()
    .storeUint(params.royaltyPercent, 16) // factor (e.g., 5%).
    .storeUint(100, 16) // base.
    .storeAddress(Address.parse(params.royaltyAddress))
    .endCell();

  // Build the update message body using opcode 4.
  const messageBody = beginCell()
    .storeUint(4, 32) // Opcode for changing content.
    .storeUint(0, 64) // Query id (0).
    .storeRef(contentCell)
    .storeRef(royaltyCell)
    .endCell();

  // Create the internal update message.
  const updateMessage = internal({
    to: nftTonAddress,
    value: toNano("0.05"),
    bounce: true,
    body: messageBody,
  });


  const walletClient = this.walletProvider.getWalletClient();
  const contract = walletClient.open(this.walletProvider.wallet);

  const seqno: number = await contract.getSeqno();
  const transfer = await contract.createTransfer({
    seqno,
    secretKey: this.walletProvider.keypair.secretKey,
    messages: [updateMessage],
  });
  await contract.send(transfer);
  console.log("Transaction sent, still waiting for confirmation...");

  await waitSeqno(seqno, this.walletProvider.wallet);

  const state = await walletClient.getContractState(
      this.walletProvider.wallet.address,
  );
  const { lt: _, hash: lastHash } = state.lastTransaction;
  return base64ToHex(lastHash);

}

/**
 * The UpdateNFTMetadataAction class processes metadata updates.
 */
class UpdateNFTMetadataAction {
  private readonly walletProvider: WalletProvider;

  constructor(walletProvider: WalletProvider) {
    this.walletProvider = walletProvider;
  }

  async update(params: UpdateNFTMetadataContent): Promise<string> {
      let metadataIpfsHash: string;
      let imagesIpfsHash: string;
      // If off-chain storage is selected, upload metadata to IPFS and update content_url.
      if (params.storage === "file") {
        elizaLogger.log("Started uploading images to IPFS...");
        imagesIpfsHash = await uploadFolderToIPFS(params.imagesFolderPath as string);
        elizaLogger.log(
          `Successfully uploaded the pictures to ipfs: https://gateway.pinata.cloud/ipfs/${imagesIpfsHash}`
        );
      
        elizaLogger.log("Started uploading metadata files to IPFS...");
        await updateMetadataFiles(params.metadataFolderPath as string, imagesIpfsHash);
        metadataIpfsHash = await uploadFolderToIPFS(params.metadataFolderPath as string);
        elizaLogger.log(
          `Successfully uploaded the metadata to ipfs: https://gateway.pinata.cloud/ipfs/${metadataIpfsHash}`
        );
      } else if(params.storage === "prompt"){
        if(!params.metadata) {
          throw new Error("Metadata is required for prompt storage");
        }
        metadataIpfsHash = await uploadJSONToIPFS(params.metadata!);
        params.newCollectionMeta = `ipfs://${metadataIpfsHash}/collection.json`;
        params.newNftCommonMeta = `ipfs://${metadataIpfsHash}/`;
      }

      const hash = await updateNFTMetadataOnChain(params); 
      return hash;
  }
}

export default {
  name: "UPDATE_NFT_METADATA",
  similes: ["NFT_UPDATE", "UPDATE_METADATA"],
  description:
    "Updates NFT metadata post-mint. Supports partial or full metadata edits with on-chain or off-chain constraints. For off-chain storage, metadata is uploaded using Helia. For on-chain updates, a custom update message (using opcode 4) is sent, updating content and royalty information.",
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    elizaLogger.log("Starting UPDATE_NFT_METADATA handler...");

    const updateDetails = await buildUpdateDetails(runtime, message, state);

    // Validate transfer content
    if (!isUpdateNFTMetadataContent(updateDetails)) {
        console.error("Invalid content for UPDATE_NFT_METADATA action.");
        if (callback) {
            callback({
                text: "Unable to process update request. Invalid content provided.",
                content: { error: "Invalid update content" },
            });
        }
        return false;
    }

    try {

      // Process the metadata update.
      const walletProvider = await initWalletProvider(runtime);
      const updateAction = new UpdateNFTMetadataAction(walletProvider);
      const hash = await updateAction.update(updateDetails);

      // Prepare the result.
      const result = {
        status: "success",
        nftAddress: updateDetails.nftAddress,
        updatedMetadata: updateDetails.metadata,
        message: "NFT metadata updated successfully",
        hash: hash,
      };

      if (callback) {
        callback({
          text: `NFT metadata updated successfully`,
          content: result,
        });
      }
    } catch (error: any) {
      elizaLogger.error("Error updating NFT metadata:", error);
      if (callback) {
        callback({
          text: `Error updating NFT metadata: ${error.message}`,
          content: { error: error.message },
        });
      }
    }
    return true;
  },
  validate: async (_runtime: IAgentRuntime) => true,
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          nftAddress: "NFT_123456789",
          metadata: {
            name: "Updated NFT Artwork",
            description: "New description for NFT",
            image: "https://example.com/new-image.png",
            storage: "off-chain" // or "on-chain"
          },
          // Fields for on-chain update (if storage is "on-chain")
          newCollectionMeta: "https://example.com/new-collection-meta.json",
          newNftCommonMeta: "https://example.com/new-nft-common-meta.json",
          royaltyAddress: "EQRoyaltyAddressExample",
          action: "UPDATE_NFT_METADATA",
        },
      },
      {
        user: "{{user1}}",
        content: {
          text: "NFT metadata updated successfully",
        },
      },
    ],
  ],
}; 