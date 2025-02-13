export const perpTradeTemplate = `Look at your LAST RESPONSE in the conversation where you confirmed a trade request.
Based on ONLY that last message, extract the trading details:

For DESK Exchange perp trading:
- Market orders (executes immediately at best available price):
  "perp buy 1 HYPE" -> { "symbol": "HYPE", "side": "Long", "amount": "1" }
  "perp sell 2 HYPE" -> { "symbol": "HYPE", "side": "Short", "amount": "2" }
  "perp market buy 1 HYPE" -> { "symbol": "HYPE", "side": "Long", "amount": "1" }
  "perp market sell 2 HYPE" -> { "symbol": "HYPE", "side": "Short", "amount": "2" }

- Limit orders (waits for specified price):
  "buy 1 HYPE at 20 USDC" -> { "symbol": "HYPE", "side": "Long", "amount": "1", "price": "20" }
  "sell 0.5 HYPE at 21 USDC" -> { "symbol": "HYPE", "side": "Short", "amount": "0.5", "price": "21" }
  "limit buy 1 HYPE at 20 USDC" -> { "symbol": "HYPE", "side": "Long", "amount": "1", "price": "20" }
  "limit sell 0.5 HYPE at 21 USDC" -> { "symbol": "HYPE", "side": "Short", "amount": "0.5", "price": "21" }

\`\`\`json
{
    "symbol": "<coin symbol>",
    "side": "<Long for buy, Short for sell>",
    "amount": "<quantity to trade>",
    "price": "<"price in USD if limit order, 0 if market order>"
}
\`\`\`

Note:
- Just use the coin symbol (HYPE, ETH, etc.)
- price is optional:
  - If specified (with "at X USD"), order will be placed at that exact price
  - If not specified, order will be placed at current market price
- Words like "market" or "limit" at the start are optional but help clarify intent

Recent conversation:
{{recentMessages}}`;

export const cancelOrderTemplate = `Look at your LAST RESPONSE in the conversation where you confirmed that user want to cancel all orders.

For example:
- I would like to cancel all my orders.
- Cancel all orders
- Cancel orders please

If the user ask to cancel a specific order, please let them know that it is not possible at the moment. Let them know that you now only have the ability to cancel all order only.

Recent conversation:
{{recentMessages}}`;

export const accountSummaryTemplate = `Look at ONLY your LAST RESPONSE message in this conversation, where you just confirmed if the user want to check the information of their account.

For example:
- I would like to check the summary of my account on DESK Exchange.
- I want to check the information on my account.
- How is my positions going?
- How is my account?
- Check account summary please

Last part of conversation:
{{recentMessages}}`;
