import {
  elizaLogger,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type Content,
  composeContext,
  generateObject,
  ModelClass,
} from "@elizaos/core";
import { Address, beginCell, Cell, internal, storeMessageRelaxed, toNano } from "@ton/core";
import { z } from "zod";
import { initWalletProvider, type WalletProvider } from "../providers/wallet";
import { base64ToHex, sleep } from "../utils/util";

export interface TransferNFTContent extends Content {
    nftAddress: string;
    newOwner: string;
}

function isTransferNFTContent(content: Content): content is TransferNFTContent {
    console.log("Content for transfer", content);
    return (
        typeof content.nftAddress === "string" &&
        typeof content.newOwner === "string"
    );
}

/**
 * Defines the schema for transferring an NFT.
 * - nftAddress: The address of the NFT smart contract.
 * - newOwner: The TON address of the new owner.
 */
const transferNFTSchema = z.object({
  nftAddress: z.string().nonempty({ message: "NFT address is required" }),
  newOwner: z.string().nonempty({ message: "New owner address is required" }),
});

/**
 * Template string to guide the AI agent (if needed).
 */
const transferNFTTemplate = `Respond with a JSON markdown block containing only the extracted values.
Example:
\`\`\`json
{
  "nftAddress": "0QDIUnzAEsgHLL7YSrvm_u7OYSKw93AQbtdidRdcbm7tQep5",
  "newOwner": "EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4"
}
\`\`\`

{{recentMessages}}

Extract and output only the values as a JSON markdown block.`;

// Add interface for contract methods
interface TonWalletContract {
    getSeqno: () => Promise<number>;
}

/**
 * The TransferNFTAction class encapsulates the logic for transferring NFT ownership.
 */
class TransferNFTAction {

    private walletProvider: WalletProvider;

    constructor(walletProvider: WalletProvider) {
        this.walletProvider = walletProvider;
    }

    private createTransferBody(params: {
      newOwner: Address;
      responseTo?: Address;
      forwardAmount?: bigint;
    }): Cell {
      const msgBody = beginCell();
      msgBody.storeUint(0x5fcc3d14, 32); // op-code for transfer
      msgBody.storeUint(0, 64); // query-id
      msgBody.storeAddress(params.newOwner);
      msgBody.storeAddress(params.responseTo || null);
      msgBody.storeBit(false); // no custom payload
      msgBody.storeCoins(params.forwardAmount || 0);
      msgBody.storeBit(0); // no forward_payload 
    
      return msgBody.endCell();
    }
  /**
   * Crafts and sends a transfer message to the NFT smart contract.
   * Note: This implementation simulates the deployment of the transfer transaction.
   */
  async transfer(params: TransferNFTContent): Promise<string> {
    // Use a TON client (using testnet endpoint; adjust as needed).
    elizaLogger.log(
        `[Plugin-TON] Transferring: ${params.nftAddress} to (${params.newOwner})`,
    );
    // { recipient: 'xx', amount: '0\\.3'}

    const walletClient = this.walletProvider.getWalletClient();
    const contract = walletClient.open(this.walletProvider.wallet);

        try {
            // Parse the NFT smart contract address.
            const nftAddressParsed = Address.parse(params.nftAddress);

            // Parse the new owner and authorized wallet addresses.
            const newOwnerAddress = Address.parse(params.newOwner);

            // Create a transfer
            const seqno: number = await contract.getSeqno();
            await sleep(1500);
            const transfer = contract.createTransfer({
                seqno,
                secretKey: this.walletProvider.keypair.secretKey,
                messages: [
                  internal({
                    value: "0.05",
                    to: nftAddressParsed,
                    body: this.createTransferBody({
                      newOwner: newOwnerAddress,
                      responseTo: contract.address,
                      forwardAmount: toNano("0.02"),
                    }),
                  }),
                ],
            });
            await sleep(1500);
            await contract.send(transfer);
            console.log("Transaction sent, still waiting for confirmation...");
            await sleep(1500);
            // this.waitForTransaction(seqno, contract);
            const state = await walletClient.getContractState(
                this.walletProvider.wallet.address,
            );
            console.log("Transaction sent, still waiting for confirmation...");
            const { lt: _, hash: lastHash } = state.lastTransaction;
            return base64ToHex(lastHash);
        } catch (error) {
            throw new Error(`Transfer failed: ${error.message}`);
        }
    }

    async waitForTransaction(seqno: number, contract: TonWalletContract) {
        let currentSeqno = seqno;
        const startTime = Date.now();
        const TIMEOUT = 120000; // 2 minutes

        while (currentSeqno === seqno) {
            if (Date.now() - startTime > TIMEOUT) {
                throw new Error(`Transaction confirmation timed out after ${TIMEOUT} minutes`);
            }
            await sleep(2000);
            currentSeqno = await contract.getSeqno();
        }
        console.log("transaction confirmed!");
    }
}

const buildTransferNFTContent = async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
): Promise<TransferNFTContent> => {

    // Initialize or update state
    let currentState = state;
    if (!currentState) {
        currentState = (await runtime.composeState(message)) as State;
    } else {
        currentState = await runtime.updateRecentMessageState(currentState);
    }

    // Compose transfer context
    const transferContext = composeContext({
        state,
        template: transferNFTTemplate,
    });

    // Generate transfer content with the schema
    const content = await generateObject({
        runtime,
        context: transferContext,
        schema: transferNFTSchema,
        modelClass: ModelClass.SMALL,
    });

    let transferContent: TransferNFTContent = content.object as TransferNFTContent;

    if (transferContent === undefined) {
        transferContent = content as unknown as TransferNFTContent;
    }

    return transferContent;
};

/**
 * The action to initiate an NFT ownership transfer.
 * It verifies that the calling (authorized) wallet is the current owner of the NFT.
 */
export default {
  name: "TRANSFER_NFT",
  similes: ["NFT_TRANSFER", "TRANSFER_OWNERSHIP"],
  description:
    "Transfers ownership of an existing NFT item. Only an authorized agent (matching the NFT's current owner) can invoke this action. The authorized wallet is verified using the wallet provider (via runtime settings).",
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    elizaLogger.log("Starting TRANSFER_NFT handler...");

    const transferDetails = await buildTransferNFTContent(
        runtime,
        message,
        state,
    );


    // Validate transfer content
    if (!isTransferNFTContent(transferDetails)) {
        console.error("Invalid content for TRANSFER_NFT action.");
        if (callback) {
            callback({
                text: "Unable to process transfer request. Invalid content provided.",
                content: { error: "Invalid transfer content" },
            });
        }
        return false;
    }
    try {

      const walletProvider = await initWalletProvider(runtime);
      // Fetch the current NFT owner via get_nft_data.
      const result = await walletProvider.getWalletClient().runMethod(Address.parse(transferDetails.nftAddress), "get_nft_data");
      // Read the owner address from the contract (assumes owner_address is the third stack element).
      //TODO: perhaps we need to read from the stack multiple times if the owner address is on the third stack element
      const currentOwnerAddress = result.stack.readAddress()?.toString();
      if (!currentOwnerAddress) {
        throw new Error("Could not retrieve current NFT owner address.");
      }
      if(currentOwnerAddress !== walletProvider.wallet.address.toString()) {
        throw new Error("You are not the owner of this NFT.");
      }
      elizaLogger.log(`Current NFT owner: ${currentOwnerAddress}`);


      // Proceed with the transfer.
      const transferAction = new TransferNFTAction(walletProvider);
      await transferAction.transfer(transferDetails);

      const response = {
        status: "success",
        nftAddress: transferDetails.nftAddress,
        newOwner: transferDetails.newOwner,
        message: "NFT ownership transfer initiated successfully",
      };

      if (callback) {
        callback({
          text: `Successfully transferred NFT from ${currentOwnerAddress} to ${transferDetails.newOwner}`,
          content: response,
        });
      }
      return true;
    } catch (error: any) {
      elizaLogger.error("Error transferring NFT:", error);
      if (callback) {
        callback({
          text: `Error transferring NFT: ${error.message}`,
          content: { error: error.message },
        });
      }
      return false;
    }
  },
  validate: async (_runtime: IAgentRuntime) => true,
  template: transferNFTTemplate,
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          nftAddress: "NFT_123456789",
          newOwner: "EQNewOwnerAddressExample",
          action: "TRANSFER_NFT",
        },
      },
      {
        user: "{{user1}}",
        content: {
          text: "NFT ownership transfer initiated successfully",
        },
      },
    ],
  ],
}; 