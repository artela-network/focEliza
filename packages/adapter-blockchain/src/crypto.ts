import { DeriveProvider } from "@ai16z/plugin-tee-verifiable-log";
import { elizaLogger } from "@ai16z/eliza";

export class Crypto {
    private deriveProvider?: DeriveProvider;
    private agentId: string;
    private bizModel: string = "onochain";

    constructor(agentID: string) {
        this.agentId = agentID;
    }

    async initialize(): Promise<void> {
        const teeEndpoint = process.env.DSTACK_SIMULATOR_ENDPOINT;
        if (!teeEndpoint) {
            throw new Error("DSTACK_SIMULATOR_ENDPOINT is not set.");
        }

        this.deriveProvider = new DeriveProvider(teeEndpoint);
        const { keys } = await this.deriveProvider.deriveKeyPair({
            agentId: this.agentId,
            bizModel: this.bizModel,
        });
    }

    async encrypt(plainText: string): Promise<string> {
        if (!this.deriveProvider) {
            elizaLogger.error("TEE deriveProvider is not initialized");
            return "";
        }

        const { success, errorMsg, ivHex, encryptedData } =
            await this.deriveProvider.encryptAgentData(
                {
                    agentId: this.agentId,
                    bizModel: this.bizModel,
                },
                plainText
            );
        if (!success) {
            elizaLogger.error("Encrypt blob data failed", errorMsg);
            return "";
        }

        return [ivHex, encryptedData].join(":");
    }

    async decrypt(encrypted: string): Promise<string> {
        if (!this.deriveProvider) {
            elizaLogger.error("TEE deriveProvider is not initialized");
            return "";
        }

        const parts = encrypted.split(":");
        if (parts.length != 2) {
            elizaLogger.error("Decrypt blob data failed", encrypted);
            return "";
        }

        const result =
            await this.deriveProvider.decryptAgentData(
                {
                    agentId: this.agentId,
                    bizModel: this.bizModel,
                },
                parts[0],
                parts[1]
            );

        if (!result.success) {
            elizaLogger.error("Encrypt blob data failed", result.errorMsg);
            return "";
        }

        return result.plainText;
    }
}