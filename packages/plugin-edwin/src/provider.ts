import type { Provider, IAgentRuntime } from "@elizaos/core";
import { Edwin } from "edwin-sdk";
import { EdwinConfig } from "edwin-sdk";

// Static variable to hold the singleton instance
let edwinRunningInstance: Edwin | null = null;

export async function getEdwinClient(): Promise<Edwin> {
    // If instance exists, return it
    if (edwinRunningInstance) {
        return edwinRunningInstance;
    }
    // Otherwise create new instance
    const edwinConfig: EdwinConfig = {
        evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
        solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY as string,
        actions: ["supply", "withdraw", "stake", "getPools", "addLiquidity"],
    };

    edwinRunningInstance = new Edwin(edwinConfig);
    return edwinRunningInstance;
}

export const edwinProvider: Provider = {
    async get(runtime: IAgentRuntime): Promise<string | null> {
        try {
            const edwin = await getEdwinClient();
            return edwin.getPortfolio();
        } catch (error) {
            console.error("Error in Edwin provider:", error);
            return null;
        }
    },
};
