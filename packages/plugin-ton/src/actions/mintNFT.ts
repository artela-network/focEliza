import {
  elizaLogger,
  composeContext,
  generateObject,
  ModelClass,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type Content,
} from "@elizaos/core";
import { z } from "zod";
import { Address, toNano } from "@ton/core";
import { initWalletProvider, WalletProvider } from "../providers/wallet";

import path from "path";
import { CollectionData, NFTCollection } from "../utils/NFTCollection";
import { topUpBalance, updateMetadataFiles, uploadFolderToIPFS, uploadJSONToIPFS, waitSeqno } from "../utils/util";
import { readdir } from "fs/promises";
import { NftItem } from "../utils/NFTItem";
/**
 * Extended interface for minting content.
 * - nftType: Defines if the NFT is part of a collection ("standalone") or if a new collection should be created ("collection").
 * - collection: For standalone NFTs, a valid NFT collection address must be provided. For new collections, this field can be omitted.
 * - metadata: NFT metadata including storage option and an optional IPFS provider for off-chain storage.
 */
export interface MintContent extends Content {
  nftType: "collection" | "standalone";
  collection?: string;
  owner: string;
  storage: "file" | "prompt";
  imagesFolderPath: string;
  metadataFolderPath: string;
  metadata?: {
    name: string;
    description?: string;
    image: string;
    content_url?: string;
    attributes?: any[];
  };
}

/**
 * A type guard to verify the MintContent payload.
 */
function isMintContent(content: MintContent): content is MintContent {
  console.log("Content for mint", content);
  return (typeof content.nftType === "string" &&
    (content.nftType === "collection" && content.collection || content.nftType === "standalone" && !content.collection) &&
    typeof content.owner === "string" &&
    typeof content.storage === "string" &&
    ((content.storage === "file" && content.imagesFolderPath && content.metadataFolderPath) || (content.storage === "prompt" && content.metadata))) as unknown as boolean;

}

/**
 * Define the schema for NFT minting.
 * - nftType: "collection" to initialize a new NFT Collection, "standalone" for existing collection NFTs.
 * - collection: Required for standalone NFTs, optional (and ignored) if initializing a new collection.
 * - owner: NFT owner address.
 * - metadata: NFT metadata according to TEP-64.
 *   * storage: Option for metadata storage ("on-chain" or "off-chain").
 *   * ipfsProvider: Optional IPFS provider to use in case of off-chain metadata.
 */
const mintNFTSchema = z
  .object({
    nftType: z.enum(["collection", "standalone"]).default("standalone"),
    collection: z.string().optional(),
    owner: z.string().nonempty({ message: "Owner address is required" }),
    storage: z.enum(["file", "prompt"]).default("file"),
    imagesFolderPath: z.string().optional(),
    metadataFolderPath: z.string().optional(),
    royaltyPercent: z.number().optional(),
    royaltyAddress: z.string().optional(),
    metadata: z.object({
      name: z.string().nonempty({ message: "NFT name is required" }),
      description: z.string().optional(),
      image: z.string().nonempty({ message: "Image URL is required" }),
      cover_image: z.string().optional(),
      social_links: z.array(z.string().optional()).optional(),
    }).optional(),
  })
  .refine((data) => {
    if (data.nftType === "standalone") {
      return data.collection && data.collection.trim() !== "";
    }
    return true;
  }, {
    message: "Collection address is required for standalone NFTs",
    path: ["collection"],
  });

  
/**
 * Template string to guide the AI agent.
 */
const mintNFTTemplate = `Respond with a JSON markdown block containing only the extracted values.
Use null for any values that cannot be determined.

Example response for standalone NFT (belongs to a collection):
\`\`\`json
{
    "nftType": "standalone",
    "collection": "EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4",
    "owner": "EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4",
    "storage": "prompt",
    "metadata": {
        "name": "Rare NFT Artwork",
        "description": "A unique NFT artwork minted on TON",
        "image": "https://example.com/nft-image.png",
        "cover_image": "https://example.com/nft-cover-image.png",
        "social_links": {
            "twitter": "https://x.com/example",
            "telegram": "https://t.me/example",
            "website": "https://example.com"
        }
    }
}
\`\`\`

Example response for collection NFT (new collection):
\`\`\`json
{
    "nftType": "collection",
    "owner": "EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4",
    "storage": "file",
    "imagesFolderPath": "path/to/images",
    "metadataFolderPath": "path/to/metadata",
    "royaltyPercent": 0.05,
    "royaltyAddress": "EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the required information to mint an NFT:
- NFT type: "collection" or "standalone"
- Collection address: For collection NFTs, the collection address must be provided.
- The owner address.
- Storage option: "file" or "prompt"
- NFT metadata including name, image, optional description for "prompt" storage,
- Images folder path: For "file" storage, the path to the images folder.
- Metadata folder path: For "file" storage, the path to the metadata folder.

Respond with a JSON markdown block containing only the extracted values.`;

/**
 * Builds the mint details by composing the context using the mintNFTTemplate,
 * then generating the desired object using the provided schema.
 */
const buildMintDetails = async (
  runtime: IAgentRuntime,
  message: Memory,
  state: State,
): Promise<MintContent> => {
  // Initialize or update state.
  let currentState = state;
  if (!currentState) {
    currentState = (await runtime.composeState(message)) as State;
  } else {
    currentState = await runtime.updateRecentMessageState(currentState);
  }

  const mintContext = composeContext({
    state: currentState,
    template: mintNFTTemplate,
  });

  const content = await generateObject({
    runtime,
    context: mintContext,
    schema: mintNFTSchema,
    modelClass: ModelClass.SMALL,
  });

  let mintContent: MintContent = content.object as MintContent;
  if (mintContent === undefined) {
    mintContent = content as unknown as MintContent;
  }
  return mintContent;
};

/**
 * The MintNFTAction class simulates NFT minting.
 * If nftType is "collection", a new NFT Collection contract is initialized and its address is generated.
 * Then an NFT item is minted. For "standalone", an NFT is minted under the provided collection address.
 * Depending on metadata.storage, the metadata is either stored on-chain or uploaded to IPFS.
 * Finally, a deploy transaction is crafted and sent using the TON SDK.
 */

class MintNFTAction {
  private walletProvider: WalletProvider;

  constructor(walletProvider: WalletProvider) {
    this.walletProvider = walletProvider;
  }

  /**
   * Crafts a deploy transaction for the NFT update in the collection.
   * This operation builds an update cell that contains a dictionary with new NFT item data.
   * @returns the hash of the transaction or undefined if the transaction fails
   */
  // async deployNFTInCollection(params: MintContent, nftIndex: number): Promise<string | undefined> {
    
  //   const walletClient = this.walletProvider.getWalletClient();
  //   const contract = walletClient.open(this.walletProvider.wallet);
    
  //   // Build NFT content:
  //   // Create a cell for metadata.
  //   // Use content_url if available (off-chain) or JSON string of metadata (on-chain).
  //   const metaString = params.metadata.content_url
  //     ? params.metadata.content_url
  //     : JSON.stringify(params.metadata);
  //   const metaCell = beginCell().storeStringTail(metaString).endCell();

  //   // Create NFT content cell that stores owner's address and a ref to the meta cell.
  //   const nftContent = beginCell()
  //     .storeAddress(Address.parse(params.owner))
  //     .storeRef(metaCell)
  //     .endCell();

  //   // Create a dictionary with one NFT item. The key is the nftIndex.
  //   const nftDictionary = Dictionary.empty<number, Cell>(Dictionary.Keys.Uint(64));
  //   nftDictionary.set(nftIndex, nftContent);

  //   // Craft the update message cell.
  //   const messageBody = beginCell()
  //     .storeUint(2, 32) // Operation code for minting NFT item in the collection.
  //     .storeUint(0, 64) // Query id (set to 0 for simulation).
  //     .storeDict(nftDictionary, Dictionary.Keys.Uint(64), {
  //       serialize: (src, builder) => {
  //         // Minimal storage deposit for this NFT item.
  //         builder.storeCoins(toNano("0.05"));
  //         builder.storeRef(src);
  //       },
  //       parse: (src) => {
  //         return beginCell()
  //           .storeCoins(src.loadCoins())
  //           .storeRef(src.loadRef())
  //           .endCell();
  //       },
  //     })
  //     .endCell();

  //   // Calculate total value to attach: minimal storage deposit plus a fee.
  //   const totalValue = String((parseFloat("0.05") + 0.015).toFixed(6));

  //   // Prepare the internal update message.
  //   const internalMessage = internal({
  //     to: Address.parse(params.collection!),
  //     value: toNano(totalValue),
  //     bounce: true,
  //     body: messageBody,
  //   });

  //     const seqno: number = await contract.getSeqno();
  //     const transfer = await contract.createTransfer({
  //         seqno,
  //         secretKey: this.walletProvider.keypair.secretKey,
  //         messages: [internalMessage],
  //     });
  //     await sleep(1500);
  //     await contract.send(transfer);
  //     await sleep(1500);
  //     // this.waitForTransaction(seqno, contract);
  //     const state = await walletClient.getContractState(
  //         this.walletProvider.wallet.address,
  //     );
  //     const { lt: _, hash: lastHash } = state.lastTransaction;
  //     return base64ToHex(lastHash) || undefined;
  // }

  /**
   * Main minting method.
   * If file storage is selected, uploads contents to IPFS and updates metadata.
   * If prompt storage is selected, uploads metadata to IPFS.
   * Then, based on nftType:
   * - For "collection": a new collection address is simulated and the first NFT (index 0) is minted.
   * - For "standalone": uses the provided collection address and queries it to get the next available NFT index.
   */
  async mint(params: MintContent): Promise<void> {

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
      metadataIpfsHash = await uploadJSONToIPFS(params.metadata);
    }

    if (params.nftType === "standalone") {

      if(!params.collection) {
        throw new Error("Collection address is required for standalone NFTs");
      }
      const files = await readdir(params.metadataFolderPath);
      files.pop();
      let index = 0;

      let seqno = await topUpBalance(this.walletProvider.wallet, files.length, params.collection);
      await waitSeqno(seqno, this.walletProvider.wallet);
      for (const file of files) {
        elizaLogger.log(`Start deploy of ${index + 1} NFT`);
        const mintParams = {
          queryId: 0,
          itemOwnerAddress: this.walletProvider.wallet.address,
          itemIndex: index,
          amount: toNano("0.05"),
          commonContentUrl: file,
        };
    
        const nftItem = new NftItem(params.collection!);
        seqno = await nftItem.deploy(this.walletProvider.wallet, mintParams);
        console.log(`Successfully deployed ${index + 1} NFT`);
        await waitSeqno(seqno, this.walletProvider.wallet);
        index++;
      }

    } else if(params.nftType === "collection"){
      // For collection NFTs, use provided collection address.
      elizaLogger.log("[TON] Start deploy of nft collection...");
      const collectionData: CollectionData = {
        ownerAddress: this.walletProvider.wallet.address,
        royaltyPercent: params.royaltyPercent as number, 
        royaltyAddress: Address.parse(params.royaltyAddress as string),
        nextItemIndex: 0,
        collectionContentUrl: `ipfs://${metadataIpfsHash}/collection.json`,
        commonContentUrl: `ipfs://${metadataIpfsHash}/`,
      };
      const collection = new NFTCollection(collectionData);
      let seqno = await collection.deploy(this.walletProvider.wallet);
      console.log(`Collection deployed: ${collection.address}`);
      await waitSeqno(seqno, this.walletProvider.wallet);
    } else {
      throw new Error("Invalid NFT type");
    } 
  }
}

export default {
  name: "MINT_NFT",
  similes: ["NFT_MINT", "MINT_NEW_NFT"],
  description:
    "Mints a new NFT. Can initialize a new NFT Collection (if selected) or mint a standalone NFT. Supports on-chain/off-chain metadata storage with IPFS upload and deploys the NFT contract using the TON SDK.",
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    elizaLogger.log("Starting MINT_NFT handler...");
    try {
      // Build mint details using the helper method.
      let mintParams = await buildMintDetails(runtime, message, state);

      // Validate the content using the type guard (for debugging purposes).
      if (!isMintContent(mintParams)) {
        throw new Error("Mint parameters validation failed");
      }

      mintParams.imagesFolderPath = runtime.getSetting("TON_NFT_IMAGES_FOLDER") || path.join(process.cwd(), "ton_nft_images");
      mintParams.metadataFolderPath = runtime.getSetting("TON_NFT_METADATA_FOLDER") || path.join(process.cwd(), "ton_nft_metadata");

      // Mint the NFT.
      const walletProvider = await initWalletProvider(runtime);
      const mintNFTAction = new MintNFTAction(walletProvider);
      const nftAddress = await mintNFTAction.mint(mintParams);

      // Prepare the result.
      const result = {
        status: "success",
        nftAddress,
        collection: mintParams.collection,
        owner: mintParams.owner,
        metadata: mintParams.metadata,
        nftType: mintParams.nftType,
        message: "NFT minted successfully",
      };

      if (callback) {
        callback({
          text: `NFT minted successfully. NFT Address: ${nftAddress}`,
          content: result,
        });
      }

      return true;
    } catch (error: any) {
      elizaLogger.error("Error minting NFT:", error);
      if (callback) {
        callback({
          text: `Error minting NFT: ${error.message}`,
          content: { error: error.message },
        });
      }
      return false;
    }
  },
  validate: async (_runtime: IAgentRuntime) => true,
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          nftType: "standalone",
          collection: "EQC123CollectionAddress", // required for standalone NFTs
          owner: "EQCOwnerAddress123",
          metadata: {
            name: "Rare NFT Artwork",
            description: "A unique NFT artwork minted on TON",
            image: "https://example.com/nft-image.png",
            storage: "off-chain",
            ipfsProvider: "ipfs.io",
          },
          action: "MINT_NFT",
        },
      },
      {
        user: "{{user1}}",
        content: {
          text: "NFT minted successfully. NFT Address: NFT_...",
        },
      },
    ],
  ],
  template: mintNFTTemplate,
}; 