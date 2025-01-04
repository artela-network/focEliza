import {Plugin} from "@ai16z/eliza";
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
