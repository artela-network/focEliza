export const getNetworkTrendingPoolsTemplate = `Determine if this is a network-specific trending pools request. If it is one of the specified situations, extract the network ID and limit:

Situation 1: "Get network trending pools"
- Message contains: network name (e.g., "solana", "ethereum", "bsc") AND phrases about pools
- Example: "Show trending pools on Solana" or "What are the hot pools on ETH?"
- Action: Extract network ID and use default limit

Situation 2: "Get specific number of network pools"
- Message contains: number AND network name AND pools reference
- Example: "Show top 5 pools on BSC" or "Get 20 trending pools on Ethereum"
- Action: Extract network ID and specific limit

Situation 3: "Get all network pools"
- Message contains: "all" AND network name AND pools reference
- Example: "Show all trending pools on Polygon" or "List all hot pools on Avalanche"
- Action: Extract network ID and set maximum limit

Network ID mappings:
- "solana", "sol" => "solana"
- "ethereum", "eth" => "eth"
- "binance smart chain", "bsc", "bnb chain" => "bsc"
- "polygon", "matic" => "polygon_pos"
- "avalanche", "avax" => "avax"

For all situations, respond with a JSON object in the format:
\`\`\`json
{
    "networkId": string,
    "limit": number
}
\`\`\`

Previous conversation for context:
{{conversation}}

You are replying to: {{message}}
`;
