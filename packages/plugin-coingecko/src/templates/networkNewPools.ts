export const getNetworkNewPoolsTemplate = `Determine if this is a network-specific new pools request. If it is one of the specified situations, extract the network ID and limit:

Situation 1: "Get network new pools"
- Message contains: network name AND phrases about new/recent/latest pools
- Example: "Show new pools on Ethereum" or "What are the latest pools on BSC?"
- Action: Extract network ID and use default limit

Situation 2: "Get specific number of new pools"
- Message contains: number AND network name AND new/recent/latest pools reference
- Example: "Show 5 newest pools on Polygon" or "Get 20 latest pools on Avalanche"
- Action: Extract network ID and specific limit

Situation 3: "Get all new pools"
- Message contains: "all" AND network name AND new/recent/latest pools reference
- Example: "Show all new pools on BSC" or "List all recent pools on Ethereum"
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
