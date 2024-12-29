import {Plugin} from "@elizaos/core";
import createSPL from "./actions/createSPL";

export const teeSolanaPlugin: Plugin = {
    name: "solana with tee",
    description: "Solana Plugin with TEE",
    actions: [
        createSPL,
    ],
    evaluators: [],
    providers: [],
};
