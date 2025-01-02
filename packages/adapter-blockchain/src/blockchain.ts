import {
    Character,
    Memory,
    elizaLogger,
 } from "@ai16z/eliza";
 import { IBlockchain, Message } from "./types";
 import Web3 from 'web3';
 import axios from 'axios';

 export class EvmCompatibleStoreAdapter implements IBlockchain {
    private account;
    private web3;

    constructor() {
        const url = process.env.BLOCKSTORE_DATA_URL;
        const privKey = process.env.BLOCKSTORE_DATA_PRIVATEKEY;

        if (!url || !privKey) {
            throw new Error("Base chain configuration is incorrect");
        }

        const web3 = new Web3(url);
        const key: string = privKey || "";
        const account = web3.eth.accounts.privateKeyToAccount(key);
        this.account = account;
        web3.eth.accounts.wallet.add(account);
        web3.eth.defaultAccount = account.address;
        this.web3= web3;
    }

    async pull<T>(idx: string): Promise<T> {
        if (!this.web3.utils.isHexStrict(idx)) {
            throw new Error(`Invalid transaction hash format of ${idx}`);
        }

        const transaction = await this.web3.eth.getTransaction(idx);
        if (!transaction) {
            throw new Error(`Get transaction of ${idx} failed`);
        }

        const data = transaction.data ?? '';
        const blobHex = data.startsWith('0x') ? data.slice(2) : data;
        if (!blobHex || blobHex === "") {
            throw new Error(`Transaction of ${idx} has no data`);
        }

        try {
            const blobData = Buffer.from(blobHex, 'hex').toString('utf8');
            return blobData as T;
        } catch (error) {
            throw new Error(`Failed to decode data for transaction "${idx}": ${error}`);
        }
    }

    async push<T>(blob: T): Promise<string> {
        const strData = String(blob);
        const hexData = Buffer.from(strData, 'utf8').toString('hex');

        try {
            let tx = {
                from: this.account.address,
                to: this.account.address,
                value: this.web3.utils.toWei('0', 'ether'),
                data: '0x' + hexData,
                gas: 0,
                gasPrice: await this.web3.eth.getGasPrice(),
                nonce: await this.web3.eth.getTransactionCount(this.account.address),
            };
            const estimatedGas = await this.web3.eth.estimateGas(tx);
            tx.gas = estimatedGas;

            const signedTx = await this.web3.eth.accounts.signTransaction(tx, this.account.privateKey);
            const transactionHash = await new Promise<string>((resolve, reject) => {
                this.web3.eth.sendSignedTransaction(signedTx.rawTransaction)
                .on('receipt', receipt => {
                    resolve(receipt.transactionHash);
                })
                .on('error', error => {
                    elizaLogger.error("Send blob to blockchain failed", error);
                    reject(new Error('Transaction failed due to error: ' + error.message));
                });
            });
            return transactionHash;
        } catch (error) {
            elizaLogger.error("Send blob to blockchain failed", error);
        }

        return "";
    }
}

export class EthereumAdapter implements IBlockchain {
  constructor() {
    // get url from character
    // get private key from env
  }

  async pull<T>(idx: string): Promise<T> {
    return Promise.reject(new Error("Ethereum adapter method 'pull' is not implemented."));
  }

  async push<T>(blob: T): Promise<string> {
    // if (blob instanceof Memory)
    return Promise.reject(new Error("Ethereum adapter method 'push' is not implemented."));
  }
}

export class CelestiaStoreAdapter implements IBlockchain {
    constructor() {
      // get url from character
      // get private key from env
    }

    async pull<T>(idx: string): Promise<T> {
        return Promise.reject(new Error("Celestia adapter method 'pull' is not implemented."));
    }

    async push<T>(blob: T): Promise<string> {
        return Promise.reject(new Error("Celestia adapter method 'push' is not implemented."));
    }
}

export class IPFSAdapter implements IBlockchain {
    private url: string;

    constructor() {
        const url = process.env.BLOCKSTORE_DATA_URL;
        if (!url || url === "") {
            throw new Error("IPFS url is not configred");
        }
        this.url = url;
    }

    async pull<T>(idx: string): Promise<T> {
        try {
            const response = await fetch(`${this.url}/api/v0/block/get?arg=${idx}`, {
                method: "POST",
                headers: {},
            });
            const data = await response.text();
            return data as T;
        } catch (error: any) {
            elizaLogger.error('Error getting block:', error.response ? error.response.data : error.message);
            throw new Error(`Failed to decode data for block "${idx}": ${error}`);
        }
    }

    async push<T>(blob: T): Promise<string> {
        const data = String(blob);
        const buffer = Buffer.from(data, 'utf-8');
        const formData = new FormData();
        const ipfsBlob = new Blob([buffer], {
            type: "text/plain",
        });
        formData.append('file', ipfsBlob, 'data.txt');

        const response = await fetch(`${this.url}/api/v0/block/put`, {
            method: "POST",
            headers: {
            },
            body: formData,
        });

        if (response.ok) {
            const result = await response.json();
            return result.Key;
        } else {
            elizaLogger.error('Error uploading string to IPFS', response);
            return "";
        }
      } catch (error: any) {
        elizaLogger.error('Error uploading string to IPFS:', error.response ? error.response.data : error.message);
        return "";
      }
  }

export function createBlockchain(
    chain: string|undefined,
  ): IBlockchain {
    switch (chain) {
      case "ethereum":
        return new EthereumAdapter();
      case "celestia":
        return new CelestiaStoreAdapter();
      case "evm":
        return new EvmCompatibleStoreAdapter();
      case "ipfs":
        return new IPFSAdapter();
      default:
        throw new Error(`Unknown blockchain adapter: ${chain}`);
    }
}
