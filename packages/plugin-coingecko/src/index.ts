import type { Plugin } from "@elizaos/core";
import getMarkets from "./actions/getMarkets";
import getPrice from "./actions/getPrice";
import getPricePerAddress from "./actions/getPricePerAddress";
import getTopGainersLosers from "./actions/getTopGainersLosers";
import getTrending from "./actions/getTrending";
import getTrendingPools from "./actions/getTrendingPools";
import getNewlyListed from "./actions/getNewlyListed";
import getNetworkTrendingPools from "./actions/getNetworkTrendingPools";
import getNetworkNewPools from "./actions/getNetworkNewPools";
import { categoriesProvider } from "./providers/categoriesProvider";
import { coinsProvider } from "./providers/coinsProvider";
import { networksProvider } from "./providers/networkProvider";

export const coingeckoPlugin: Plugin = {
    name: "coingecko",
    description: "CoinGecko Plugin for Eliza",
    actions: [
        getPrice,
        getPricePerAddress,
        getTrending,
        getTrendingPools,
        getMarkets,
        getTopGainersLosers,
        getNewlyListed,
        getNetworkTrendingPools,
        getNetworkNewPools,
    ],
    evaluators: [],
    providers: [categoriesProvider, coinsProvider, networksProvider],
};

export default coingeckoPlugin;
