import { type Provider, type IAgentRuntime, type Memory, ServiceType } from "@elizaos/core";
import type { ArbitrageService } from "../services/ArbitrageService";
import type { ArbitrageState } from "../type";

export const marketProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message: Memory): Promise<ArbitrageState> => {
        const service = runtime.getService(ServiceType.ARBITRAGE) as ArbitrageService;
        const markets = await service.evaluateMarkets();

        return {
            opportunities: markets.length,
            totalProfit: "0", // Calculate total profit
            lastUpdate: new Date().toISOString(),
            markets: {}  // This will be populated by the service
        };
    }
};