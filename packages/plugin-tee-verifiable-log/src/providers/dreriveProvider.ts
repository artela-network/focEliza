import { DeriveKeyProvider } from "@ai16z/plugin-tee";
import * as crypto from "crypto";

export class DeriveProvider {
    private provider: DeriveKeyProvider;

    constructor(teeModel: string) {
        this.provider = new DeriveKeyProvider(teeModel);
    }

    async deriveKeyPair(params: {
        agentId: string;
        bizModel: string;
    }): Promise<Buffer> {
        const keyPath = `/${params.agentId}/tee/keypair/${params.bizModel}`;
        const seed = await this.provider.rawDeriveKey(keyPath, params.agentId);
        // 从 PEM 格式解析私钥
        const privateKey = crypto.createPrivateKey({
            key: seed.key,
            format: "pem",
        });
        // 导出私钥为 DER 格式
        const privateKeyDer = privateKey.export({
            format: "der",
            type: "pkcs8",
        });
        // 使用 SHA-256 对私钥进行哈希，派生出对称加密密钥
        return crypto.createHash("sha256").update(privateKeyDer).digest();
    }

    async encryptAgentData(
        params: {
            agentId: string;
            bizModel: string;
        },
        plainText: string
    ): Promise<{
        success: boolean;
        errorMsg: string;
        ivHex: string;
        encryptedData: string;
    }> {
        try {
            const rawKey = await this.deriveKeyPair(params);
            const { ivHex, encrypted } = this.encrypt(plainText, rawKey);

            return {
                success: true,
                errorMsg: "",
                ivHex: ivHex,
                encryptedData: encrypted,
            };
        } catch (error) {
            return {
                success: true,
                errorMsg: "encryptAgentData failed:" + error,
                ivHex: "",
                encryptedData: "",
            };
        }
    }

    async decryptAgentData(
        params: {
            agentId: string;
            bizModel: string;
        },
        ivHex: string,
        encryptedData: string
    ): Promise<{
        success: boolean;
        errorMsg: string;
        plainText: string;
    }> {
        try {
            const rawKey = await this.deriveKeyPair(params);
            const plainText = this.decrypt(encryptedData, ivHex, rawKey);
            return {
                success: true,
                errorMsg: "",
                plainText: plainText,
            };
        } catch (error) {
            return {
                success: false,
                errorMsg: "decryptAgentData failed: " + error,
                plainText: "",
            };
        }
    }

    // 加密函数
    private encrypt(
        text: string,
        key: Buffer
    ): { ivHex: string; encrypted: string } {
        // 生成随机初始化向量（IV）
        const iv = crypto.randomBytes(16);

        // 创建 cipher 对象
        const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

        // 加密
        let encrypted = cipher.update(text, "utf8", "hex");
        encrypted += cipher.final("hex");

        // 返回 IV 和加密后的数据（IV 需要在解密时使用）
        return { ivHex: iv.toString("hex"), encrypted: encrypted };
    }

    // 解密函数
    private decrypt(encryptedData: string, ivHex: string, key: Buffer): string {
        const decipher = crypto.createDecipheriv(
            "aes-256-cbc",
            key,
            Buffer.from(ivHex, "hex")
        );
        let decrypted = decipher.update(encryptedData, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    }
}
