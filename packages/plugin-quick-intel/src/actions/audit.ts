import {
    Action,
    ActionExample,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    composeContext,
    elizaLogger,
    generateMessageResponse
} from "@elizaos/core";
import { auditTemplate } from "../templates";
import { extractTokenInfo } from "../utils/chain-detection";

interface AuditResponse {
    tokenDetails?: {
        tokenName: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

interface DexPair {
    chainId: string;
    [key: string]: unknown;
}

interface DexResponse {
    pairs?: DexPair[];
    otherChains?: string[];
}
class TokenAuditAction {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private getGeckoChainId(chain: string): string {
        // Only include mappings that differ from our standard chain names
        const geckoSpecificMappings: { [key: string]: string } = {
            'polygon': 'polygon_pos',
            'avalanche': 'avax',
            'gnosis': 'xdai',
            'arbitrum_nova': 'arbitrum_nova',
            'polygonzkevm': 'polygon-zkevm',
            'ethereumpow': 'ethw'
        };

        const normalizedChain = chain.toLowerCase();
        
        // Return specific mapping if it exists, otherwise return the normalized chain
        return geckoSpecificMappings[normalizedChain] || normalizedChain;
    }

    async audit(chain: string, tokenAddress: string): Promise<AuditResponse> {
        elizaLogger.log("Auditing token:", { chain, tokenAddress });
        const myHeaders = new Headers();
        myHeaders.append("X-QKNTL-KEY", this.apiKey);
        myHeaders.append("Content-Type", "application/json");

        const requestOptions: RequestInit = {
            method: "POST",
            headers: myHeaders,
            body: JSON.stringify({ chain, tokenAddress }),
            redirect: "follow" as RequestRedirect,
        };

        const response = await fetch("https://api.quickintel.io/v1/getquickiauditfull", requestOptions);
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        return await response.json();
    }

    private async fetchDexScreenerData(tokenAddress: string, chain: string): Promise<DexResponse | null> {
        elizaLogger.log("Fetching DexScreener data:", { tokenAddress, chain });
        const requestOptions: RequestInit = {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        };

        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, requestOptions);
        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (!data?.pairs?.length) {
            return null;
        }

        const chainPairs = data.pairs.filter((pair: DexPair) =>
            pair.chainId.toLowerCase() === chain.toLowerCase() || 
            pair.chainId.toLowerCase().includes(chain.toLowerCase())
        );

        const otherChains = data.pairs
            .filter((pair: DexPair) => pair.chainId.toLowerCase() !== chain.toLowerCase())
            .map((pair: DexPair): string => pair.chainId);

        return {
            pairs: chainPairs,
            otherChains: Array.from(new Set(otherChains))
        };
    }

    private async fetchGeckoTerminalData(tokenAddress: string, chain: string): Promise<DexResponse | null> {
        elizaLogger.log("Fetching GeckoTerminal data:", { tokenAddress, chain });
        
        // Convert chain to GeckoTerminal format
        const geckoChain = this.getGeckoChainId(chain);
        
        const requestOptions: RequestInit = {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        };

        try {
            const response = await fetch(
                `https://api.geckoterminal.com/api/v2/networks/${geckoChain}/tokens/${tokenAddress}/pools?include=included&page=1`, 
                requestOptions
            );
            
            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            if (!data?.data?.length) {
                return null;
            }

            // Transform GeckoTerminal data to match DexScreener format
            const pairs = data.data.map((pool: any) => ({
                chainId: chain,
                pairAddress: pool.attributes.address,
                dexId: pool.relationships.dex.data.id,
                pairCreatedAt: pool.attributes.pool_created_at,
                priceUsd: pool.attributes.base_token_price_usd,
                priceChange: {
                    h24: pool.attributes.price_change_percentage.h24,
                    h6: pool.attributes.price_change_percentage.h6,
                    h1: pool.attributes.price_change_percentage.h1,
                    m5: pool.attributes.price_change_percentage.m5
                },
                liquidity: {
                    usd: pool.attributes.reserve_in_usd
                },
                volume: {
                    h24: pool.attributes.volume_usd.h24,
                    h6: pool.attributes.volume_usd.h6,
                    h1: pool.attributes.volume_usd.h1,
                    m5: pool.attributes.volume_usd.m5
                },
                txns: {
                    h24: {
                        buys: pool.attributes.transactions.h24.buys,
                        sells: pool.attributes.transactions.h24.sells
                    },
                    h1: {
                        buys: pool.attributes.transactions.h1.buys,
                        sells: pool.attributes.transactions.h1.sells
                    }
                },
                baseToken: {
                    address: pool.relationships.base_token.data.id.split('_')[1],
                    name: pool.attributes.name.split(' / ')[0]
                },
                quoteToken: {
                    address: pool.relationships.quote_token.data.id.split('_')[1],
                    name: pool.attributes.name.split(' / ')[1].split(' ')[0]
                },
                fdv: pool.attributes.fdv_usd,
                marketCap: pool.attributes.market_cap_usd
            }));

            return {
                pairs,
                otherChains: [] // GeckoTerminal API is chain-specific, so no other chains
            };
        } catch (error) {
            elizaLogger.error("Error fetching GeckoTerminal data:", error);
            return null;
        }
    }

    async fetchDexData(tokenAddress: string, chain: string): Promise<DexResponse | null> {
        elizaLogger.log("Fetching DEX data:", { tokenAddress, chain });

        // Try DexScreener first
        const dexScreenerData = await this.fetchDexScreenerData(tokenAddress, chain);
        if (dexScreenerData?.pairs?.length) {
            return dexScreenerData;
        }

        // If DexScreener returns no results, try GeckoTerminal
        const geckoData = await this.fetchGeckoTerminalData(tokenAddress, chain);
        if (geckoData?.pairs?.length) {
            return geckoData;
        }

        // If both APIs return no results, return null
        return null;
    }
}

export const auditAction: Action = {
    name: "AUDIT_TOKEN",
    description: "Perform a security audit on a token using QuickIntel",
    similes: ["SCAN_TOKEN", "CHECK_TOKEN", "TOKEN_SECURITY", "ANALYZE_TOKEN"],
    suppressInitialMessage: true,
    validate: async (runtime: IAgentRuntime) => {
        const apiKey = runtime.getSetting("QUICKINTEL_API_KEY");
        return typeof apiKey === "string" && apiKey.length > 0;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting QuickIntel audit handler...");

        try {
            const apiKey = runtime.getSetting("QUICKINTEL_API_KEY");
            if (!apiKey) {
                throw new Error("QuickIntel API key not configured");
            }

            // Extract chain and address from the message content
            const messageText = message.content.text;
            const { chain, tokenAddress } = extractTokenInfo(messageText);

            if (!chain || !tokenAddress) {
                throw new Error("Could not determine chain and token address. Please specify both the chain and token address.");
            }

            let dexData = null;
            
            // Perform audit
            elizaLogger.log("Performing audit for:", { chain, tokenAddress });
            const action = new TokenAuditAction(apiKey);
            const auditData = await action.audit(chain, tokenAddress);

            if(auditData) {
                try {
                    dexData = await action.fetchDexData(tokenAddress, chain);
                } catch(error) {}
            }

            const newState = await runtime.composeState(message, {
                ...state,
                auditData: JSON.stringify(auditData, null, 2),
                marketData: auditData?.tokenDetails?.tokenName && dexData ? JSON.stringify(dexData, null, 2) : null,
            });


            // Generate analysis using audit data
            const context = composeContext({
                state: newState,
                template: auditTemplate
            });

            const responseContent = await generateMessageResponse({
                runtime,
                context,
                modelClass: ModelClass.LARGE
            });

            if (!responseContent) {
                throw new Error("Failed to generate audit analysis");
            }

            //await callback(response);
            if (callback) {
                const response = {
                    text: responseContent.text,
                    content: {
                        success: true,
                        data: auditData,
                        params: { chain, tokenAddress }
                    },
                    action: responseContent.action,
                    inReplyTo: message.id
                };

                const memories = await callback(response);
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in AUDIT_TOKEN handler:", error?.message, error?.error);

            if (callback) {
                await callback({
                    text: "An error occurred while performing the token audit. Please try again later, and ensure the address is correct, and chain is supported.",
                    content: { error: "Internal server error" },
                    inReplyTo: message.id
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you check if this token is safe? 0x742d35Cc6634C0532925a3b844Bc454e4438f44e on BSC",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll analyze this token's security for you.",
                    action: "AUDIT_TOKEN",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here's what I found in the security audit:\n\n🔒 Overall Security Status: Medium Risk\n\nKey Findings:\n✅ Contract is verified\n✅ Not a honeypot\n⚠️ Ownership not renounced\n\nDetailed Analysis:\n...",
                },
            },
        ],
    ] as ActionExample[][],
};