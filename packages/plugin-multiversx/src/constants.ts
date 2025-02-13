// Network configuration object for different environments (mainnet, devnet, testnet)
export const MVX_NETWORK_CONFIG = {
    mainnet: {
        chainID: "1", // Mainnet chain ID
        apiURL: "https://api.multiversx.com", // Mainnet API URL
        explorerURL: "https://explorer.multiversx.com",
        graphURL: "https://internal-graph.xexchange.com/graphql",
        wrappedEgldIdentifier: "WEGLD-bd4d79",
        xExchangeLockAddress:
            "erd1qqqqqqqqqqqqqpgq6nu2t8lzakmcfmu4pu5trjdarca587hn2jpsyjapr5",
        xExchangeOriginURL: "https://xexchange.com",
    },
    devnet: {
        chainID: "D", // Devnet chain ID
        apiURL: "https://devnet-api.multiversx.com", // Devnet API URL,
        explorerURL: "https://devnet-explorer.multiversx.com",
        graphURL: "https://devnet-graph.xexchange.com/graphql",
        wrappedEgldIdentifier: "WEGLD-a28c59",
        xExchangeLockAddress:
            "erd1qqqqqqqqqqqqqpgq2l97gw2j4wnlem4y2rx7dudqlssjtwpu0n4sd0u3w2",
        xExchangeOriginURL: "https://devnet.xexchange.com",
    },
    testnet: {
        chainID: "T", // Testnet chain ID
        apiURL: "https://testnet-api.multiversx.com", // Testnet API URL
        explorerURL: "https://testnet-explorer.multiversx.com",
        graphURL: "https://testnet-graph.xexchange.com/graphql",
        wrappedEgldIdentifier: "WEGLD-dd8471",
        xExchangeLockAddress:
            "erd1qqqqqqqqqqqqqpgq5fszwql529edaggetu7vkauc07dzed9zexksqdewxw",
        xExchangeOriginURL: "https://devnet.xexchange.com",
    },
};
