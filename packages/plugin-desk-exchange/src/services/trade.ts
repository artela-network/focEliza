import { AxiosResponse } from "axios";
import { CancelOrderRequest, PlaceOrderRequest } from "../types";
import axios from "axios";

export const placeOrder = async (
    endpoint: string,
    jwt: string,
    order: PlaceOrderRequest
): Promise<AxiosResponse> => {
    if (!endpoint || !jwt || !order) {
        throw new Error("Missing required parameters");
    }
    return await axios.post(`${endpoint}/v2/place-order`, order, {
        headers: {
            authorization: `Bearer ${jwt}`,
            "content-type": "application/json",
        },
        timeout: 5000,
        validateStatus: (status) => status === 200,
    });
};

export const cancelOrder = async (
    endpoint: string,
    jwt: string,
    order: CancelOrderRequest
): Promise<AxiosResponse> => {
    if (!endpoint || !jwt || !order) {
        throw new Error("Missing required parameters");
    }
    if (!order.order_digest) {
        throw new Error("Missing order digest");
    }
    return await axios.post(`${endpoint}/v2/cancel-order`, order, {
        headers: {
            authorization: `Bearer ${jwt}`,
            "content-type": "application/json",
        },
        timeout: 5000,
        validateStatus: (status) => status === 200,
    });
};
