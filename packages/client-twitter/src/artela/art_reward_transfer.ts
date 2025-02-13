import { ethers } from "ethers";

export class EthTransfer {
    private wallet: ethers.Wallet;
    private readonly provider: ethers.JsonRpcProvider;

    constructor(rpcUrl: string, privateKey: string) {
        this.wallet = new ethers.Wallet(privateKey);
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    async transferAmount(toAddress: string, amount: number): Promise<string> {
        const signer = this.wallet.connect(this.provider);

        // 计算交易金额，将 ETH 转换为 wei
        const valueInWei = ethers.parseUnits(amount.toString(), "ether");

        // 发送交易
        const txResponse = await signer.sendTransaction({
            to: toAddress,
            value: valueInWei,
        });

        // 等待交易确认并返回交易哈希
        return txResponse.hash;
    }
}

