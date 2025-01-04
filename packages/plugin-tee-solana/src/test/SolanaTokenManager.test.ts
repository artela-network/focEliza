import { describe, it, expect, beforeAll } from "vitest";
import { SolanaTokenManager } from "../biz/SolanaTokenManager"; // 假设类的文件名为 SolanaTokenManager.ts
import { Keypair ,clusterApiUrl} from "@solana/web3.js";
import bs58 from "bs58";

describe("SolanaTokenManager", () => {
    let tokenManager: SolanaTokenManager;

    beforeAll(() => {
        const rpcUrl:string = clusterApiUrl("devnet");
       // const rpcUrl: string = "http://localhost:8899";

        const pkary: number[] = [
            110, 142, 209, 125, 50, 223, 165, 222, 96, 48, 157, 1, 168, 64, 138,
            198, 11, 234, 163, 115, 176, 7, 107, 37, 123, 105, 227, 17, 120, 67,
            88, 238, 234, 135, 185, 110, 136, 43, 187, 157, 255, 191, 67, 36,
            144, 12, 148, 215, 232, 54, 14, 247, 247, 198, 109, 62, 39, 103,
            150, 69, 143, 55, 240, 103,
        ];
        const privateKeyUint8Array = Uint8Array.from(pkary);

        tokenManager = new SolanaTokenManager(rpcUrl, pkary);
    });

    it("should initialize the payer account", async () => {
        await expect(tokenManager.initialize()).resolves.not.toThrow();
    });

    it("should create a new token", async () => {
        const token = await tokenManager.createToken({
            name: "AI_TEST_TOKEN",
            symbol: "ATST",
            uri: "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/DeveloperPortal/metadata.json",
        });

        expect(token.mintAuthority).toBeDefined();
        expect(token.mintAuthority.publicKey).toBeDefined();
        console.log(
            "Created token with mint address:",
            token.mintAuthority.publicKey
        );
        const destinationkp = Keypair.generate();

        const stringPromise =await tokenManager.transferToken({
            mint: token.mint,
            mintAuthority: token.mintAuthority,
            destination: destinationkp.publicKey,
            amount: BigInt(100000),
        });
        console.log(
            "stringPromise:",
            stringPromise,
            "destinationkp.publicKey:",
            destinationkp.publicKey
        );

        await tokenManager.getTokenAccountsByOwner(
            destinationkp.publicKey
        );

    }, 300000);
});
