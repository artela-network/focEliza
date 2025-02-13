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
import {
  Address,
  Dictionary,
} from "@ton/core";
import { z } from "zod";
import { initWalletProvider, type WalletProvider } from "../providers/wallet";

export interface GetCollectionDataContent extends Content {
  collectionAddress: string;
}

function isGetCollectionDataContent(content: Content): content is GetCollectionDataContent {
  return typeof content.collectionAddress === "string";
}

/**
 * Schema for retrieving NFT collection data.
 * - collectionAddress: the NFT collection smart contract address.
 * - endpoint: optional TON RPC endpoint, defaults to testnet if not specified.
 */
const getCollectionDataSchema = z.object({
  collectionAddress: z.string().nonempty("Collection address is required"),
});

/**
 * Template guiding the extraction of collection data parameters.
 * The output should be a JSON markdown block similar to:
 *
 * {
 *   "collectionAddress": "EQSomeCollectionAddressExample",
 *   "endpoint": "https://testnet.toncenter.com/api/v2/jsonRPC"
 * }
 */
const getCollectionDataTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
  "collectionAddress": "EQCGScrZe1xbyWqWDvdI6mzP-GAcAWFv6ZXuaJOuSqemxku4",
}

{{recentMessages}}

Given the recent messages, extract the following information about the requested NFT collection data:
- Collection address

Respond with a JSON markdown block containing only the extracted values.`;


/**
 * GetCollectionDataAction encapsulates the core logic to retrieve NFT collection data.
 */
class GetCollectionDataAction {
    private readonly walletProvider: WalletProvider;

    constructor(walletProvider: WalletProvider) {
        this.walletProvider = walletProvider;
    }

  /**
   * Retrieves and parses collection data from the provided collection address.
   * Returns an object containing the next NFT index, owner address and parsed NFT items.
   */
  async getData(
    collectionAddress: string,
  ): Promise<{
    collectionAddress: string;
    nextItemIndex: number;
    ownerAddress: string | null;
    nftItems: Array<{ index: number; deposit: string; ownerAddress: string; meta: string }>;
    message: string;
  }> {
    const walletClient = this.walletProvider.getWalletClient();

    try {
      const addr = Address.parse(collectionAddress);

      // Run the get_collection_data method on the collection contract.
      // Per TEP-62, it returns:
      // (int next_item_index, cell collection_content, slice owner_address).
      const result = await walletClient.runMethod(addr, "get_collection_data");
  
      // Extract the next NFT index.
      const nextItemIndex = result.stack.readNumber();

      const nftItems = [];
      for(let i = 0; i < nextItemIndex; i++) {
        const item = await walletClient.runMethod(addr, "get_nft_item", 
          [{ type: "int", value: BigInt(i) }]);
        nftItems.push(item);
      }
      let ownerAddressStr: string | null = null;
      try {
        const ownerAddress = result.stack.readAddress();
        ownerAddressStr = ownerAddress.toString();
      } catch (e) {
        ownerAddressStr = null;
      }
  
      return {
        collectionAddress,
        nextItemIndex,
        ownerAddress: ownerAddressStr,
        nftItems,
        message: "Collection data fetched successfully",
      };
    } catch (error: any) {
      elizaLogger.error("Error fetching collection data:", error);
      throw error;
    }
  }
}

/**
 * Helper function that builds collection data details.
 */
const buildGetCollectionData = async (
  runtime: IAgentRuntime,
  message: Memory,
  state: State
): Promise<GetCollectionDataContent> => {

    // Initialize or update state
    let currentState = state;
    if (!currentState) {
        currentState = (await runtime.composeState(message)) as State;
    } else {
        currentState = await runtime.updateRecentMessageState(currentState);
    }

  const getCollectionContext = composeContext({
    state: currentState,
    template: getCollectionDataTemplate,
  });
  const content = await generateObject({
    runtime,
    context: getCollectionContext,
    schema: getCollectionDataSchema,
    modelClass: ModelClass.SMALL,
  });

    let buildGetCollectionDataContent: GetCollectionDataContent = content.object as GetCollectionDataContent;

    if (buildGetCollectionDataContent === undefined) {
        buildGetCollectionDataContent = content as unknown as GetCollectionDataContent;
    }

    return buildGetCollectionDataContent;
};

export default {
  name: "GET_NFT_COLLECTION_DATA",
  similes: ["GET_COLLECTION_DATA", "FETCH_NFT_COLLECTION"],
  description:
    "Fetches collection data (next NFT index, array of NFT items, and owner address) from the provided NFT collection address.",
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    elizaLogger.log("Starting GET_NFT_COLLECTION_DATA handler...");
      // Build collection data details using the helper method.
      const getCollectionDetails = await buildGetCollectionData(runtime, message, state);

      if(!isGetCollectionDataContent(getCollectionDetails)) {
        if(callback) {
          callback({
            text: "Unable to process get collection data request. Invalid content provided.",
            content: { error: "Invalid get collection data content" },
          });
        }
        return false;
      }

      try {
        const walletProvider = await initWalletProvider(runtime);
        const getCollectionDataAction = new GetCollectionDataAction(walletProvider);
        const collectionData = await getCollectionDataAction.getData(getCollectionDetails.collectionAddress);

      if (callback) {
        callback({
          text: JSON.stringify(collectionData, null, 2),
          content: collectionData,
        });
      }
      return true;
    } catch (error: any) {
      elizaLogger.error("Error fetching collection data:", error);
      if (callback) {
        callback({
          text: `Error fetching collection data: ${error.message}`,
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
          collectionAddress: "EQSomeCollectionAddressExample",
          action: "GET_NFT_COLLECTION_DATA",
        },
      },
      {
        user: "{{user1}}",
        content: {
          text: "Collection data fetched successfully. Next index: ..., NFT items: [...]",
        },
      },
    ],
  ],
}; 