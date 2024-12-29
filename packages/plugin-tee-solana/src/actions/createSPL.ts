import {composeContext, elizaLogger, generateObject, ModelClass} from "@elizaos/core";
import {
    Action,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    Plugin,
    State,
} from "@elizaos/core";
import { generateImage } from "@elizaos/core";



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

    name: "CREATE_SPL_TOKEN",
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
        console.log("======content=====", content);
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Create a new token called APPLE_SPL with symbol APPLE and generate a description about it.",
                },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Token APPLE (APPLE_SPL) created successfully.",
                    action: "CREATE_SPL_TOKEN",
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
