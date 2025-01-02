import { BlockStoreMsgType } from "@ai16z/eliza";

/**
 * Header for demonstration
 */
export interface BlobHeader {
    /** Unique identifier */
    prev: any;
}

/**
 * Structure representing a single blob of data
 */
export interface BlobData {
    /** Type of the message */
    msgType: BlockStoreMsgType;

    /** Actual message data */
    data: any;
}

/**
 * Represents a complete message structure
 */
export interface Message {
    /** Unique identifier for the message */
    prev: string;

    /** Array of blobs containing message data and type */
    blob: BlobData[];
}

/**
 * Interface for blockchain
 */
export type IBlockchain = {
    /**
     * Fetches the value associated with the specified key from the store.
     * @param idx - The unique identifier for the value to retrieve.
     * @returns A promise that resolves with the retrieved value.
     */
    pull: <T>(idx: string) => Promise<T>;
    /**
     * Stores a value in the store with an automatically generated key.
     * @param value - The value to store.
     * @returns A promise that resolves with the generated key for the stored value.
     */
    push: <T>(value: T) => Promise<string>;
};