import {
    type Action,
    type ActionExample,
    type IAgentRuntime,
    type Memory,
    type State,
    type HandlerCallback,
    elizaLogger,
    composeContext,
} from "@elizaos/core";
import {
    generateJwt,
    generateNonce,
    getEndpoint,
    getSubaccount,
} from "../services/utils";
import { ethers } from "ethers";
import { getSubaccountSummary } from "../services/account";
import { cancelOrder } from "../services/trade";
import { cancelOrderTemplate } from "../templates";

export const cancelOrders: Action = {
    name: "CANCEL_ORDERS",
    similes: ["CANCEL_ALL_ORDERS", "CANCEL", "CANCEL_ALL"],
    description: "Cancel all open orders on DESK Exchange",
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
            template: cancelOrderTemplate,
        });

        try {
            const endpoint = getEndpoint(runtime);
            const wallet = new ethers.Wallet(
                runtime.getSetting("DESK_EXCHANGE_PRIVATE_KEY")
            );
            const jwt = await generateJwt(endpoint, wallet, 0, generateNonce());

            const subaccountSummaryResponse = await getSubaccountSummary(
                endpoint,
                jwt,
                getSubaccount(wallet.address, 0)
            );

            const openOrders =
                subaccountSummaryResponse.data?.data?.open_orders;

            if (openOrders && openOrders.length > 0) {
                for (const o of openOrders) {
                    await cancelOrder(endpoint, jwt, {
                        symbol: o.symbol,
                        subaccount: getSubaccount(wallet.address, 0),
                        order_digest: o.order_digest,
                        nonce: generateNonce(),
                        is_conditional_order: false,
                        wait_for_reply: false,
                    });
                }
                callback({
                    text: `Successfully cancelled ${openOrders.length} orders.`,
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error canceling orders:", {
                message: error.message,
                code: error.code,
                data: error.response?.data,
            });
            if (callback) {
                callback({
                    text: `Error canceling orders: ${error.message} ${error.response?.data?.errors}`,
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
                    text: "Cancel all my orders",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll cancel all your open orders.",
                    action: "CANCEL_ORDERS",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Successfully cancelled 2 open orders",
                },
            },
        ],
    ] as ActionExample[][],
};

export default cancelOrders;
