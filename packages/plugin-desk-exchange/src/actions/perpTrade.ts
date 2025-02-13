import {
    type Action,
    type ActionExample,
    type IAgentRuntime,
    type Memory,
    type State,
    type HandlerCallback,
    composeContext,
    elizaLogger,
    generateObjectDeprecated,
    ModelClass,
} from "@elizaos/core";
import {
    DeskExchangeError,
    PlaceOrderRequest,
    PlaceOrderSchema,
} from "../types";
import { perpTradeTemplate } from "../templates";
import { ethers } from "ethers";
import {
    generateNonce,
    generateJwt,
    getSubaccount,
    getEndpoint,
    formatNumber,
} from "../services/utils";
import { placeOrder } from "../services/trade";

export const perpTrade: Action = {
    name: "PERP_TRADE",
    similes: ["PERP_ORDER", "PERP_BUY", "PERP_SELL"],
    description: "Place a perpetual contract trade order on DESK Exchange",
    validate: async (runtime: IAgentRuntime) => {
        return !!(
            runtime.getSetting("DESK_EXCHANGE_PRIVATE_KEY") &&
            runtime.getSetting("DESK_EXCHANGE_NETWORK")
        );
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: Record<string, unknown>,
        callback?: HandlerCallback
    ) => {
        // Initialize or update state
        state = !state
            ? await runtime.composeState(message)
            : await runtime.updateRecentMessageState(state);

        const context = composeContext({
            state,
            template: perpTradeTemplate,
        });

        const content = await generateObjectDeprecated({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
        });

        try {
            if (!content) {
                throw new DeskExchangeError(
                    "Could not parse trading parameters from conversation"
                );
            }

            const endpoint = getEndpoint(runtime);

            const wallet = new ethers.Wallet(
                runtime.getSetting("DESK_EXCHANGE_PRIVATE_KEY")
            );
            const jwt = await generateJwt(endpoint, wallet, 0, generateNonce());

            elizaLogger.info(
                "Raw content from LLM:",
                JSON.stringify(content, null, 2)
            );

            const processesOrder = {
                symbol: `${content.symbol}USD`,
                side: content.side,
                amount: content.amount,
                price: content.price,
                nonce: generateNonce(),
                broker_id: "DESK",
                order_type: Number(content.price) === 0 ? "Market" : "Limit",
                reduce_only: false,
                subaccount: getSubaccount(wallet.address, 0),
            };
            const parseResult = PlaceOrderSchema.safeParse(processesOrder);
            if (!parseResult.success) {
                throw new Error(
                    `Invalid perp trade content: ${JSON.stringify(
                        parseResult.error.errors,
                        null,
                        2
                    )}`
                );
            }
            elizaLogger.info(
                "Processed order:",
                JSON.stringify(processesOrder, null, 2)
            );

            const response = await placeOrder(
                endpoint,
                jwt,
                processesOrder as PlaceOrderRequest
            );

            elizaLogger.info(response.data);

            if (callback && response.status === 200) {
                const orderResponse = response.data.data;
                callback({
                    text: `Successfully placed a ${orderResponse.side} ${
                        orderResponse.order_type
                    } order of size ${formatNumber(
                        orderResponse.quantity
                    )} on ${orderResponse.symbol} at ${
                        orderResponse.order_type === "Market"
                            ? "market price"
                            : formatNumber(orderResponse.price) + " USD"
                    } on DESK Exchange.`,
                    content: response.data,
                });
            } else {
                callback({
                    text: `Place order failed with ${response.data.errors}.`,
                    content: response.data,
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error executing trade:", {
                content,
                message: error.message,
                code: error.code,
                data: error.response?.data,
            });
            if (callback) {
                callback({
                    text: `Error executing trade: ${error.message} ${error.response?.data?.errors}`,
                    content: { error: error.message },
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
                    text: "Long 0.1 BTC at 20 USD",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll place a buy order for 0.1 BTC at 20 USD.",
                    action: "PERP_TRADE",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Successfully placed a limit order to buy 0.1 BTC at 20 USD",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Short 2 BTC at 21 USD",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll place a sell order for 2 BTC at 21 USD.",
                    action: "PERP_TRADE",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Successfully placed a limit order to sell 2 BTC at 21 USD",
                },
            },
        ],
    ] as ActionExample[][],
};

export default perpTrade;
