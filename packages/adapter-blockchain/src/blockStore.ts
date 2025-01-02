import Queue from 'queue';
import {
    IBlockStoreAdapter,
    BlockStoreMsgType,
    Character,
    IDatabaseAdapter,
    elizaLogger,
} from '@ai16z/eliza';
import { IBlockchain, Message } from './types';
import { createBlockchain } from "./blockchain";
import { Registry } from './registry';
import { Crypto } from './crypto';
import { BlockStoreUtil } from './util';

export class BlockStoreQueue implements IBlockStoreAdapter {
    private queue;
    private isProcessing: boolean = false;
    private id: string;

    private crypto: Crypto;

    private buffer: { msgType: BlockStoreMsgType; msg: any }[] = [];
    private bufferLimit: number = 10;
    private timeout: number = 10000;
    private timeoutHandle: NodeJS.Timeout | null = null;

    private blobUtil?: BlockStoreUtil;
    private blockChain?: IBlockchain;
    private registry?: Registry;

    constructor(id: string) {
        this.queue = new Queue({ concurrency: 1 });
        this.id = id;
        this.crypto = new Crypto(this.id);
    }

    async initialize() {
        this.blockChain = createBlockchain(process.env.BLOCKSTORE_CHAIN);
        this.registry = new Registry();
        this.blobUtil = new BlockStoreUtil(this.id, this.crypto, this.blockChain);
        await this.crypto.initialize();
        this.startProcessing();
    }

    async enqueue<T>(msgType: BlockStoreMsgType, msg: T): Promise<void> {
        this.buffer.push({ msgType, msg });

        if (this.buffer.length >= this.bufferLimit) {
            this.flushBuffer();
        } else if (!this.timeoutHandle) {
            this.timeoutHandle = setTimeout(() => this.flushBuffer(), this.timeout);
        }
    }

    private flushBuffer(): void {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }

        if (this.buffer.length === 0) return;

        const tasks = this.buffer.slice();
        this.buffer = [];

        const task = async () => {
            try {
                elizaLogger.debug(`Processing batch task with ${tasks.length} messages.`);
                await this.processBatchTask(tasks);
                elizaLogger.debug(`Batch task completed.`);
            } catch (err) {
                elizaLogger.error('Batch task failed, re-queuing messages:', err);
                tasks.forEach(({ msgType, msg }) => this.enqueue(msgType, msg));
            }
        };

        this.queue.push(task);

        if (!this.isProcessing) {
            this.startProcessing();
        }
    }

    private async startProcessing(): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.queue.length > 0 || this.queue.pending > 0) {
            await new Promise<void>((resolve, reject) => {
                this.queue.start((err) => {
                    if (err) {
                        elizaLogger.error('Error processing queue:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }

        this.isProcessing = false;
    }

    private async processBatchTask(tasks: { msgType: BlockStoreMsgType; msg: any }[]): Promise<void> {
        const characters = tasks
            .filter(task => task.msgType == BlockStoreMsgType.character)
            .map(task => task.msg);

        if (characters.length > 0) {
            // only update to latest character
            const ret = await this.processCharacter(characters[characters.length-1]);
            if (!ret) {
                elizaLogger.error("Process character update failed");
            }
        }

        const blobTasks = tasks.filter(task => task.msgType !== BlockStoreMsgType.character);
        if (blobTasks.length === 0) {
            return;
        }

        // get last idx
        if (!this.registry) {
            throw new Error("Blockstore registry is not initialized");
        }
        const idx = await this.registry.getBlobIdx(this.id);

        // marshal the messages
        const blob = blobTasks.map(({ msgType, msg }) => ({
            msgType,
            data: JSON.stringify(msg).trim(),
        }));

        const message: Message = {
            prev: idx,
            blob: blob,
        };

        const encryptedData = await this.crypto.encrypt(JSON.stringify(message).trim());
        if (!this.blockChain) {
            throw new Error("Blockstore blockchain is not initialized");
        }
        const uIdx = await this.blockChain.push(encryptedData);

        // update idx
        const ret = await this.registry.updateOrRegisterBlobIdx(this.id, uIdx);
        if (!ret) {
            elizaLogger.error("Update to blockchain failed");
        }
    }

    private async processCharacter(msg: any): Promise<boolean> {
        // submit the character to blob
        const characterData = JSON.stringify(msg).trim();
        const encryptedData = await this.crypto.encrypt(characterData);

        if (!this.blockChain) {
            throw new Error("Blockstore blockchain is not initialized");
        }
        const idx = await this.blockChain.push(encryptedData);

        // save the idx of character to registry
        if (!this.registry) {
            throw new Error("Blockstore registry is not initialized");
        }
        return await this.registry.updateOrRegisterCharacter(this.id, idx);
    }

    async restoreCharacter(): Promise<Character> {
        if (!this.blobUtil) {
            throw new Error("Blockstore blobUtil is not initialized");
        }
        return this.blobUtil.restoreCharacter();
    }

    async restoreMemory(database: IDatabaseAdapter) {
        if (!this.blobUtil) {
            throw new Error("Blockstore blobUtil is not initialized");
        }
        return this.blobUtil.restoreMemory(database);
    }
}
