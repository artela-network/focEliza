import type { Plugin } from "@elizaos/core";
import { edwinProvider, getEdwinClient } from "./provider";
import { getEdwinActions } from "./actions";

// Initial banner
console.log("\n┌═════════════════════════════════════┐");
console.log("│            EDWIN PLUGIN             │");
console.log("│                 ,_,                 │");
console.log("│                (o,o)                │");
console.log("│                {`\"'}                │");
console.log("│                -\"-\"-                │");
console.log("├─────────────────────────────────────┤");
console.log("│  Initializing Edwin Plugin...       │");
console.log("│  Version: 0.0.1                     │");
console.log("└═════════════════════════════════════┘");

export const edwinPlugin: Plugin = {
    name: "[Edwin] Integration",
    description: "Edwin integration plugin",
    providers: [edwinProvider],
    evaluators: [],
    services: [],
    actions: await getEdwinActions({
        getClient: getEdwinClient,
    }),
};

export default edwinPlugin;
