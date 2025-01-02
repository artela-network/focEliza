import Web3 from 'web3';
import { RegistryABI } from './contract/abi';
import { elizaLogger } from '@ai16z/eliza';

export class Registry {
    private contract;
    private account;

    constructor() {
        const contractAddress = process.env.BLOCKSTORE_REGISTRY_ADDR;
        const url = process.env.BLOCKSTORE_REGISTRY_URL;
        const privKey = process.env.BLOCKSTORE_REGISTRY_PRIVATEKEY;

        if (!contractAddress || !url || !privKey) {
            throw new Error("Block store registry configuration is incorrect.");
        }

        const web3 = new Web3(url);
        const key: string = privKey || "";
        const account = web3.eth.accounts.privateKeyToAccount(key);
        web3.eth.accounts.wallet.add(account);
        web3.eth.defaultAccount = account.address;
        this.account = account;

        this.contract = new web3.eth.Contract(RegistryABI, contractAddress);
    }

    /**
     * Get the idx for a given agent id from the contract.
     * @param id The agent id to query.
     * @returns The associated Idx of the id.
     */
    async getBlobIdx(id: string): Promise<string> {
        if (id === "") {
            return ""
        }

        const idx = await this.getFromContract("getBlobIdx", [id]);
        return idx;
    }

    /**
     * Register or update idx for a given agent id in the contract.
     * @param id The agent id to register or update.
     * @param idx The idx to associate with the agent id.
     */
    async updateOrRegisterBlobIdx(id: string, idx: string): Promise<boolean> {
        elizaLogger.info(`Updating memories at index ${idx} to blockchain`);
        return await this.updateInContract("updateOrRegisterBlobIdx", [id, idx]);
    }

    /**
     * Get stored character json string for a given agent id from the contract.
     * @param id The agent id to query.
     * @returns The associated character json string of the id.
     */
    async getCharacter(id: string): Promise<string> {
        if (id === "") {
            return ""
        }

        const idx = await this.getFromContract("getCharacter", [id]);
        return idx;
    }

    /**
     * Register or update idx for a given agent id in the contract.
     * @param id The agent id to register or update.
     * @param character The character json string to associate with the agent id.
     */
    async updateOrRegisterCharacter(id: string, character: string): Promise<boolean> {
        elizaLogger.info(`Update new character to blockchain`);
        return await this.updateInContract("updateOrRegisterCharacter", [id, character]);
    }

    /**
     * Get stored keystore json string for a given agent id from the contract.
     * @param id The agent id to query.
     * @returns The associated Idx of the id.
     */
    async getKeyStore(id: string): Promise<string> {
        if (id === "") {
            return ""
        }

        const idx = await this.getFromContract("getKeyStore", [id]);
        return idx;
    }

    /**
     * Register or update idx for a given agent id in the contract.
     * @param id The agent id to register or update.
     * @param keystore The keystore json string to associate with the agent id.
     */
    async updateOrRegisterKeyStore(id: string, keystore: string): Promise<boolean> {
        elizaLogger.info(`Update keystore to blockchain`);
        return await this.updateInContract("updateOrRegisterKeyStore", [id, keystore]);
    }

    // Get a value from the contract using a specified method.
    private async getFromContract(methodName: string, params: any[]): Promise<string> {
        try {
            const result = await this.contract.methods[methodName](...params).call();
            return result;
        } catch (error) {
            elizaLogger.error(`Error during getFromContract (${methodName}):`, error);
            return "";
        }
    }

    // Update a value in the contract using a specified method.
    private async updateInContract(methodName: string, params: any[]): Promise<boolean> {
        try {
            await this.contract.methods[methodName](
                ...params
            ).send(
                { from: this.account.address }
            );
            return true;
        } catch (error) {
            elizaLogger.error(`Error during updateInContract (${methodName}):`, error);
            return false;
        }
    }
}