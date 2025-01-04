import {
    IVerifiableLogProvider,
    VerifiableAgent,
    VerifiableDAO,
    VerifiableLog,
} from "../types/logTypes.ts";
import {
    DeriveKeyProvider,
    RemoteAttestationProvider,
} from "@ai16z/plugin-tee";

export class VerifiableLogProvider implements IVerifiableLogProvider {
    private dao: VerifiableDAO;
    private keyPath: string = "/keys/verifiable_key";

    constructor(dao: VerifiableDAO) {
        this.dao = dao;
    }

    async log(
        params: {
            agentId: string;
            roomId: string;
            userId: string;
            type: string;
            content: string;
        },
        endpoint: string
    ): Promise<boolean> {
        let singed: string = "";

        const provider = new DeriveKeyProvider(endpoint);

        try {
            const evmKeypair = await provider.deriveEcdsaKeypair(
                this.keyPath,
                params.agentId
            );

            const signature = await evmKeypair.signMessage({
                message: params.content,
            });
            singed = signature.toString();

            // evmKeypair can now be used for Ethereum operations
        } catch (error) {
            console.error("EVM key derivation failed:", error)
            return false;
        }
        return this.dao.addLog(<VerifiableLog>{
            agent_id: params.agentId,
            room_id: params.roomId,
            user_id: params.userId,
            type: params.type,
            content: params.content,
            signature: singed,
        });
    }

    async registerAgent(
        params: {
            agentId: string;
            agentName: string;
        },
        endpoint: string
    ): Promise<boolean> {
        if (params.agentId === undefined) {
            throw new Error("agentId is required");
        }

        const agent = await this.dao.getAgent(params.agentId);
        if (agent !==null){
            return true;
        }
        const provider = new DeriveKeyProvider(endpoint);
        const evmKeypair = await provider.deriveEcdsaKeypair(
            this.keyPath,
            params.agentId
        );
        const publicKey = evmKeypair.publicKey;

        return this.dao.addAgent(<VerifiableAgent>{
            agent_id: params.agentId,
            agent_name: params.agentName,
            agent_keypair_path: this.keyPath,
            agent_keypair_vlog_pk: publicKey,
        });
    }

    async generateAttestation(
        params: {
            agentId: string;
            publicKey: string;
        },
        endpoint: string
    ): Promise<string> {
        if (params.agentId === undefined || params.publicKey === undefined) {
            throw new Error("agentId and publicKey are required");
        }
        const raProvider = new RemoteAttestationProvider(endpoint);
        try {
            // Generate 32-byte report data (reportData) containing the hash value of the public key.
            const reportData = JSON.stringify(params);
            // Call the remote attestation interface.
            return raProvider.generateAttestation(reportData);
        } catch (error) {
            console.error("Failed to generate attestation quote:", error);
            throw error;
        }
    }
}
