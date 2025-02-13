import { bringAgentWithWalletAddress } from "../functions/bringIQData.ts";

const onchainJson = await (async () => {
    if (!process.env.IQ_WALLET_ADDRESS) {
        return null;
    }

    return await bringAgentWithWalletAddress();
})();

export { onchainJson };
