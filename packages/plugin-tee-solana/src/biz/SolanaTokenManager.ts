import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    sendAndConfirmTransaction,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";

import {
    createInitializeMetadataPointerInstruction,
    createInitializeMintInstruction,
    ExtensionType,
    getMintLen,
    LENGTH_SIZE,
    TOKEN_2022_PROGRAM_ID,
    TYPE_SIZE,
    createMint,
    mintTo,
    getOrCreateAssociatedTokenAccount,
    AccountLayout,
    transfer,
    getMint,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAccount,
    Account,
    Mint,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    createInitializeInstruction,
    pack,
    TokenMetadata,
} from "@solana/spl-token-metadata";

export class SolanaTokenManager {
    private connection: Connection;
    private payer: Keypair;

    constructor(clusterUrl: string, privateKeyArray: number[]) {
        this.connection = new Connection(clusterUrl, "confirmed");
        const privateKeyUint8Array = Uint8Array.from(privateKeyArray);
        this.payer = Keypair.fromSecretKey(privateKeyUint8Array);
    }

    async initialize(): Promise<void> {
        const airdropSignature = await this.connection.requestAirdrop(
            this.payer.publicKey,
            2 * LAMPORTS_PER_SOL
        );
        await this.connection.confirmTransaction({
            signature: airdropSignature,
            ...(await this.connection.getLatestBlockhash()),
        });
    }

    async getAccountInfo(tokenAccount: PublicKey): Promise<Account> {
        return await getAccount(
            this.connection,
            tokenAccount,
            "",
            TOKEN_2022_PROGRAM_ID
        );
    }

    async getMintInfo(mintAddr: PublicKey): Promise<Mint> {
        return await getMint(
            this.connection,
            mintAddr,
            "",
            TOKEN_2022_PROGRAM_ID
        );
    }

    async getBalance(account: PublicKey): Promise<number> {
        // 获取账户余额（单位为 lamports）
        const balance = await this.connection.getBalance(account);
        // 将 lamports 转换为 SOL
        const balanceInSOL = balance / LAMPORTS_PER_SOL;
        return balanceInSOL;
    }

    async getTokenAccountsByOwner(account: PublicKey): Promise<void> {
        const tokenAccounts = await this.connection.getTokenAccountsByOwner(
            account,
            {
                programId: TOKEN_2022_PROGRAM_ID,
            }
        );

        console.log("Token                                         Balance");
        console.log(
            "------------------------------------------------------------"
        );
        tokenAccounts.value.forEach((tokenAccount) => {
            const accountData = AccountLayout.decode(tokenAccount.account.data);
            console.log(
                `${new PublicKey(accountData.mint)}   ${accountData.amount}`
            );
        });
    }

    async createToken({
        name,
        symbol,
        uri,
        decimals = 9,
        additionalMetadata = [["description", "Only Test On Solana"]],
    }: {
        name: string;
        symbol: string;
        uri: string;
        mintAmount: number;
        decimals?: number;
        additionalMetadata?: [string, string][];
    }): Promise<{
        mint: PublicKey;
        createdmint: PublicKey;
        withdrawWithheldAuthority: Keypair;
        transferFeeConfigAuthority: Keypair;
        mintAuthority: Keypair;
    }> {
        const mintKeypair = Keypair.generate();
        const mint = mintKeypair.publicKey;
        const mintAuthority = Keypair.generate();
        const transferFeeConfigAuthority = Keypair.generate();
        const withdrawWithheldAuthority = Keypair.generate();
        console.log(
            "mint:",
            mint.toBase58(),
            "mintAuthority:",
            mintAuthority.publicKey.toBase58()
        );

        const metadata: TokenMetadata = {
            mint: mint,
            name,
            symbol,
            uri,
            additionalMetadata,
        };
        const mintLen = getMintLen([ExtensionType.MetadataPointer]);
        const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

        const mintLamports =
            await this.connection.getMinimumBalanceForRentExemption(
                mintLen + metadataLen
            );
        const mintTransaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: this.payer.publicKey,
                newAccountPubkey: mint,
                space: mintLen,
                lamports: mintLamports,
                programId: TOKEN_2022_PROGRAM_ID,
            }),
            createInitializeMetadataPointerInstruction(
                mint,
                this.payer.publicKey,
                mint,
                TOKEN_2022_PROGRAM_ID
            ),
            createInitializeMintInstruction(
                mint,
                decimals,
                mintAuthority.publicKey,
                null,
                TOKEN_2022_PROGRAM_ID
            ),
            createInitializeInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                mint: mint,
                metadata: mint,
                name: metadata.name,
                symbol: metadata.symbol,
                uri: metadata.uri,
                mintAuthority: mintAuthority.publicKey,
                updateAuthority: mintAuthority.publicKey,
            })
        );
        try {
            await sendAndConfirmTransaction(this.connection, mintTransaction, [
                this.payer,
                mintKeypair,
                mintAuthority,
            ]);
        } catch (error) {
            console.error("Transaction failed:", error);
            if ("logs" in error) {
                console.error("Logs:", error.logs);
            }
            throw error;
        }
        const createdmint = await createMint(
            this.connection,
            this.payer,
            mintAuthority.publicKey,
            mintAuthority.publicKey,
            decimals,
            undefined,
            undefined,
            TOKEN_2022_PROGRAM_ID
        );
        return {
            mint: mint,
            createdmint: createdmint,
            withdrawWithheldAuthority: withdrawWithheldAuthority,
            transferFeeConfigAuthority: transferFeeConfigAuthority,
            mintAuthority: mintAuthority,
        };
    }

    async transferToken({
        mint,
        mintAuthority,
        destination,
        amount,
    }: {
        mint: PublicKey;
        createdmint: PublicKey;
        mintAuthority: Keypair;
        destination: PublicKey;
        amount: bigint;
    }): Promise<string> {
        // Get the token account of the fromWallet address, and if it does not exist, create it
        const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.payer,
            mint,
            mintAuthority.publicKey,
            false, // Allow PDA Owner (default: false)
            "confirmed", // Commitment level (default: confirmed)
            undefined,
            TOKEN_2022_PROGRAM_ID, // SPL Token program ID (default)
            ASSOCIATED_TOKEN_PROGRAM_ID // Associated Token program ID (default)
        );
        const toTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            this.payer,
            mint,
            destination,
            false, // Allow PDA Owner (default: false)
            "confirmed", // Commitment level (default: confirmed)
            undefined,
            TOKEN_2022_PROGRAM_ID, // SPL Token program ID (default)
            ASSOCIATED_TOKEN_PROGRAM_ID // Associated Token program ID (default)
        );

        let signatureto = await mintTo(
            this.connection,
            this.payer,
            mint,
            fromTokenAccount.address,
            mintAuthority,
            amount,
            [],
            undefined,
            TOKEN_2022_PROGRAM_ID
        );

        console.log("mint tx:", signatureto);
        try {
            const signature = await transfer(
                this.connection,
                this.payer,
                fromTokenAccount.address,
                toTokenAccount.address,
                mintAuthority,
                amount,
                [],
                undefined,
                TOKEN_2022_PROGRAM_ID
            );

            return signature.toString();
        } catch (error) {
            console.error("Transaction failed:", error);
            if ("logs" in error) {
                console.error("Logs:", error.logs);
            }
            throw error;
        }
    }
}
