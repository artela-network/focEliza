const CHAIN_MAPPINGS = {
    eth: ['eth', 'ethereum', 'ether', 'mainnet'],
    bsc: ['bsc', 'binance', 'bnb', 'binance smart chain', 'smartchain'],
    polygon: ['polygon', 'matic', 'poly'],
    arbitrum: ['arbitrum', 'arb', 'arbitrum one'],
    avalanche: ['avalanche', 'avax', 'avalanche c-chain'],
    base: ['base'],
    optimism: ['optimism', 'op', 'optimistic'],
    fantom: ['fantom', 'ftm', 'opera'],
    cronos: ['cronos', 'cro'],
    gnosis: ['gnosis', 'xdai', 'dai chain'],
    celo: ['celo'],
    moonbeam: ['moonbeam', 'glmr'],
    moonriver: ['moonriver', 'movr'],
    harmony: ['harmony', 'one'],
    aurora: ['aurora'],
    metis: ['metis', 'andromeda'],
    boba: ['boba'],
    kcc: ['kcc', 'kucoin'],
    heco: ['heco', 'huobi'],
    okex: ['okex', 'okexchain', 'okc'],
    zkera: ['zkera', 'zksync era', 'era'],
    zksync: ['zksync', 'zks'],
    polygonzkevm: ['polygon zkevm', 'zkevm'],
    linea: ['linea'],
    mantle: ['mantle'],
    scroll: ['scroll'],
    core: ['core', 'core dao'],
    telos: ['telos'],
    syscoin: ['syscoin', 'sys'],
    conflux: ['conflux', 'cfx'],
    klaytn: ['klaytn', 'klay'],
    fusion: ['fusion', 'fsn'],
    canto: ['canto'],
    nova: ['nova', 'arbitrum nova'],
    fuse: ['fuse'],
    evmos: ['evmos'],
    astar: ['astar'],
    dogechain: ['dogechain', 'doge'],
    thundercore: ['thundercore', 'tt'],
    oasis: ['oasis'],
    velas: ['velas'],
    meter: ['meter'],
    sx: ['sx', 'sx network'],
    kardiachain: ['kardiachain', 'kai'],
    wanchain: ['wanchain', 'wan'],
    gochain: ['gochain'],
    ethereumpow: ['ethereumpow', 'ethw'],
    pulse: ['pulsechain', 'pls'],
    kava: ['kava'],
    milkomeda: ['milkomeda'],
    nahmii: ['nahmii'],
    worldchain: ['worldchain'],
    ink: ['ink'],
    soneium: ['soneium'],
    sonic: ['sonic'],
    morph: ['morph'],
    real: ['real','re.al'],
    mode: ['mode'],
    zeta: ['zeta'],
    blast: ['blast'],
    unichain: ['unichain'],
    abstract: ['abstract'],
    step: ['step', 'stepnetwork'],
    ronin: ['ronin', 'ron'],
    iotex: ['iotex'],
    shiden: ['shiden'],
    elastos: ['elastos', 'ela'],
    solana: ['solana', 'sol'],
    tron: ['tron', 'trx'],
    sui: ['sui']
} as const;

// Regular expressions for different token address formats
const TOKEN_PATTERNS = {
    evm: /\b(0x[a-fA-F0-9]{40})\b/i,
    solana: /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/i,
    tron: /\b(T[1-9A-HJ-NP-Za-km-z]{33})\b/i,
    sui: /\b(0x[a-fA-F0-9]{64})\b/i
};

export interface TokenInfo {
    chain: string | null;
    tokenAddress: string | null;
}

function normalizeChainName(chain: string): string | null {
    const normalizedInput = chain.toLowerCase().trim();

    for (const [standardName, variations] of Object.entries(CHAIN_MAPPINGS)) {
        if (variations.some((v: string) => normalizedInput.includes(v))) {
            return standardName;
        }
    }

    return normalizedInput;
}

export function extractTokenInfo(message: string): TokenInfo {
    const result: TokenInfo = {
        chain: null,
        tokenAddress: null
    };

    // Clean the message
    const cleanMessage = message.toLowerCase().trim();

    // Try to find chain name first
    // 1. Look for chain names after prepositions
    const prepositionPattern = /(?:on|for|in|at|chain)\s+([a-zA-Z0-9]+)/i;
    const prepositionMatch = cleanMessage.match(prepositionPattern);

    // 2. Look for chain names anywhere in the message
    for (const [chainName, variations] of Object.entries(CHAIN_MAPPINGS)) {
        if (variations.some((v: string) => cleanMessage.includes(v))) {
            result.chain = chainName;
            break;
        }
    }

    // If chain wasn't found in mappings but was found through preposition pattern,
    // use the exact chain name provided
    if (!result.chain && prepositionMatch?.[1]) {
        result.chain = normalizeChainName(prepositionMatch[1]);
    }

    // Find token address using different patterns
    for (const [chainType, pattern] of Object.entries(TOKEN_PATTERNS)) {
        const match = message.match(pattern);
        if (match?.[1]) {
            result.tokenAddress = match[1];

            // If we haven't found a chain yet and it's a Solana address, set chain to Solana
            if (!result.chain && chainType === 'solana' && match[1].length >= 32) {
                result.chain = 'solana';
            }
            break;
        }
    }

    // If we still don't have a chain but have an EVM address, default to ethereum
    if (!result.chain && result.tokenAddress?.startsWith('0x')) {
        result.chain = 'eth';
    }

    return result;
}