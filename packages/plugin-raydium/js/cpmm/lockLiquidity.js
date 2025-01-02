"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockLiquidity = void 0;
const config_1 = require("../config");
const utils_1 = require("./utils");
const lockLiquidity = () => __awaiter(void 0, void 0, void 0, function* () {
    const raydium = yield (0, config_1.initSdk)();
    const poolId = '2umXxGh6jY63wDHHQ4yDv8BJbjzLNnKgYDwRqas75nnt';
    let poolInfo;
    if (raydium.cluster === 'mainnet') {
        const data = yield raydium.api.fetchPoolById({ ids: poolId });
        poolInfo = data[0];
        if (!(0, utils_1.isValidCpmm)(poolInfo.programId))
            throw new Error('target pool is not CPMM pool');
    }
    else {
        const data = yield raydium.cpmm.getPoolInfoFromRpc(poolId);
        poolInfo = data.poolInfo;
    }
    yield raydium.account.fetchWalletTokenAccounts();
    const lpBalance = raydium.account.tokenAccounts.find((a) => a.mint.toBase58() === poolInfo.lpMint.address);
    if (!lpBalance)
        throw new Error(`you do not have balance in pool: ${poolId}`);
    const { execute, extInfo } = yield raydium.cpmm.lockLp({
        poolInfo,
        lpAmount: lpBalance.amount,
        withMetadata: true,
        txVersion: config_1.txVersion,
    });
    const { txId } = yield execute({ sendAndConfirm: true });
    console.log('lp locked', { txId: `https://explorer.solana.com/tx/${txId}`, extInfo });
    process.exit();
});
exports.lockLiquidity = lockLiquidity;
(0, exports.lockLiquidity)();
//# sourceMappingURL=lockLiquidity.js.map