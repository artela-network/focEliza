import {
    composeContext,
    elizaLogger,
    generateObject,
    ModelClass,
} from "@ai16z/eliza";
import {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    Plugin,
    State,
} from "@ai16z/eliza";
import { generateImage } from "@elizaos/core";
import bs58 from "bs58";
import {SolanaTokenManager} from "../biz/SolanaTokenManager.ts";

const fomoTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "tokenMetadata": {
        "name": "Test Token",
        "symbol": "TEST",
        "description": "A test token",
        "image_description": "create an image of a rabbit"
    },
    "buyAmountSol": "0.00069",
    "requiredLiquidity": "85"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract or generate (come up with if not included) the following information about the requested token creation:
- Token name
- Token symbol
- Token description
- Token image description
- Amount of SOL to buy

Respond with a JSON markdown block containing only the extracted values.`;

const createSPL: Action = {
    name: "CREATE_SOLANA_TOKEN",
    similes: ["CREATE_SOLANA_TOKEN", "LAUNCH_SOLANA_TOKEN"],
    description:
        "Create a new token using SOL. Requires deployer private key, token metadata.",
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true; //return isCreateAndBuyContent(runtime, message.content);
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: {
            width?: number;
            height?: number;
            count?: number;
            negativePrompt?: string;
            numIterations?: number;
            guidanceScale?: number;
            seed?: number;
            modelId?: string;
            jobId?: string;
        },
        callback: HandlerCallback
    ) => {
        // Compose state if not provided
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Generate structured content from natural language
        const pumpContext = composeContext({
            state,
            template: fomoTemplate,
        });

        const content = await generateObject({
            runtime,
            context: pumpContext,
            modelClass: ModelClass.LARGE,
        });

        var rpc = runtime.getSetting("TEE_SOLANA_RPC");
        var pkBase58 = runtime.getSetting("TEE_SOLANA_TOKEN_PAYER_PRIVATE_KEY");
        const secretKey = bs58.decode(pkBase58);

        var solanaTokenManager = new SolanaTokenManager(rpc,secretKey);


        console.log("======content=====", content);
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Please execute an action to create a Solana token called APPLE_SPL with the symbol APPLE and generate a short description." },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Here's an Solana token called APPLE_SPL",
                    action: "CREATE_SOLANA_TOKEN",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a new solana token called APPLE_SPL with symbol APPLE and generate a description about it.",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Token APPLE (APPLE_SPL) created successfully.",
                    action: "CREATE_SOLANA_TOKEN",
                    content: {
                        tokenInfo: {
                            symbol: "APPLE",
                            address:
                                "EugPwuZ8oUMWsYHeBGERWvELfLGFmA1taDtmY8uMeX6r",
                            creator:
                                "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
                            name: "APPLE_SPL",
                            description: "A APPLE_SPL token",
                        },
                    },
                },
            },
        ],
    ],
} as Action;

export default createSPL;
