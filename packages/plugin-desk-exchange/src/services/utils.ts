import { type IAgentRuntime } from "@elizaos/core";
import { DeskExchangeError } from "../types";
import { ethers } from "ethers";
import axios from "axios";
import { randomBytes } from "crypto";

export const generateNonce = (): string => {
    const expiredAt = BigInt(Date.now() + 1000 * 60) * BigInt(1 << 20);
    const random = parseInt(randomBytes(3).toString("hex"), 16) % (1 << 20);
    return (expiredAt + BigInt(random)).toString();
};

export const generateJwt = async (
    endpoint: string,
    wallet: ethers.Wallet,
    subaccountId: number,
    nonce: string
): Promise<string> => {
    const message = `generate jwt for ${wallet.address?.toLowerCase()} and subaccount id ${subaccountId} to trade on happytrading.global with nonce: ${nonce}`;
    const signature = await wallet.signMessage(message);

    const response = await axios.post(
        `${endpoint}/v2/auth/evm`,
        {
            account: wallet.address,
            subaccount_id: subaccountId.toString(),
            nonce,
            signature,
        },
        {
            headers: { "content-type": "application/json" },
        }
    );

    if (response.status === 200) {
        return response.data.data.jwt;
    } else {
        throw new DeskExchangeError("Could not generate JWT");
    }
};

export const getSubaccount = (
    account: string,
    subaccountId: number
): string => {
    // pad address with subaccountId to be 32 bytes (64 hex characters)
    //  0x + 40 hex characters (address) + 24 hex characters (subaccountId)
    const subaccountIdHex = BigInt(subaccountId).toString(16).padStart(24, "0");
    return account.concat(subaccountIdHex);
};

export const getEndpoint = (runtime: IAgentRuntime): string => {
    return runtime.getSetting("DESK_EXCHANGE_NETWORK") === "mainnet"
        ? "https://api.happytrading.global"
        : "https://stg-trade-api.happytrading.global";
};

export const formatNumber = (
    num: string | number,
    decimalPlaces?: number
): string => {
    return Number(num).toLocaleString(undefined, {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: decimalPlaces || 8,
    });
};
