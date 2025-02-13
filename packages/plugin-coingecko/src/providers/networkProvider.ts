import {
    type IAgentRuntime,
    type Memory,
    type Provider,
    type State,
    elizaLogger,
} from "@elizaos/core";
import axios from "axios";
import { getApiConfig, validateCoingeckoConfig } from "../environment";

interface NetworkAttributes {
    name: string;
    coingecko_asset_platform_id: string;
}

interface NetworkItem {
    id: string;
    type: string;
    attributes: NetworkAttributes;
}

interface NetworksResponse {
    data: NetworkItem[];
}

const CACHE_KEY = "coingecko:networks";
const CACHE_TTL = 30 * 60; // 30 minutes
const MAX_RETRIES = 3;

async function fetchNetworks(runtime: IAgentRuntime): Promise<NetworkItem[]> {
    const config = await validateCoingeckoConfig(runtime);
    const { baseUrl, apiKey, headerKey } = getApiConfig(config);

    const response = await axios.get<NetworksResponse>(
        `${baseUrl}/onchain/networks`,
        {
            headers: {
                accept: "application/json",
                [headerKey]: apiKey,
            },
            timeout: 5000, // 5 second timeout
        }
    );

    if (!response.data?.data?.length) {
        throw new Error("Invalid networks data received");
    }

    return response.data.data;
}

async function fetchWithRetry(runtime: IAgentRuntime): Promise<NetworkItem[]> {
    let lastError: Error | null = null;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            return await fetchNetworks(runtime);
        } catch (error) {
            lastError = error;
            elizaLogger.error(`Networks fetch attempt ${i + 1} failed:`, error);
            await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
    }

    throw (
        lastError ||
        new Error("Failed to fetch networks after multiple attempts")
    );
}

async function getNetworks(runtime: IAgentRuntime): Promise<NetworkItem[]> {
    try {
        // Try to get from cache first
        const cached = await runtime.cacheManager.get<NetworkItem[]>(CACHE_KEY);
        if (cached) {
            return cached;
        }

        // Fetch fresh data
        const networks = await fetchWithRetry(runtime);

        // Cache the result
        await runtime.cacheManager.set(CACHE_KEY, networks, {
            expires: CACHE_TTL,
        });

        return networks;
    } catch (error) {
        elizaLogger.error("Error fetching networks:", error);
        throw error;
    }
}

function formatNetworksContext(networks: NetworkItem[]): string {
    const mainNetworks = ["eth", "bsc", "polygon_pos", "avax", "solana"];

    const popular = networks
        .filter((n) => mainNetworks.includes(n.id))
        .map((n) => `${n.attributes.name} - ID: ${n.id}`);

    return `
Available blockchain networks:

Major networks:
${popular.map((n) => `- ${n}`).join("\n")}

Total available networks: ${networks.length}

You can use these network IDs when querying network-specific data.
`.trim();
}

export const networksProvider: Provider = {
    // eslint-disable-next-line
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        try {
            const networks = await getNetworks(runtime);
            return formatNetworksContext(networks);
        } catch (error) {
            elizaLogger.error("Networks provider error:", error);
            return "Blockchain networks list is temporarily unavailable. Please try again later.";
        }
    },
};

// Helper function for actions to get raw networks data
export async function getNetworksData(
    runtime: IAgentRuntime
): Promise<NetworkItem[]> {
    return getNetworks(runtime);
}
