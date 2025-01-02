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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deposit = void 0;
const raydium_sdk_v2_1 = require("@raydium-io/raydium-sdk-v2");
const bn_js_1 = __importDefault(require("bn.js"));
const config_1 = require("../config");
const decimal_js_1 = __importDefault(require("decimal.js"));
const utils_1 = require("./utils");
const deposit = () => __awaiter(void 0, void 0, void 0, function* () {
    const raydium = yield (0, config_1.initSdk)();
    // SOL - USDC pool
    const poolId = '6rXSohG2esLJMzKZzpFr1BXUeXg8Cr5Gv3TwbuXbrwQq';
    let poolInfo;
    let poolKeys;
    if (raydium.cluster === 'devnet') {
        const data = yield raydium.api.fetchPoolById({ ids: poolId });
        poolInfo = data[0];
        if (!(0, utils_1.isValidCpmm)(poolInfo.programId))
            throw new Error('target pool is not CPMM pool');
    }
    else {
        const data = yield raydium.cpmm.getPoolInfoFromRpc(poolId);
        poolInfo = data.poolInfo;
        poolKeys = data.poolKeys;
    }
    console.log(123123444, poolInfo);
    const uiInputAmount = '0.0001';
    const inputAmount = new bn_js_1.default(new decimal_js_1.default(uiInputAmount).mul(Math.pow(10, poolInfo.mintA.decimals)).toFixed(0));
    const slippage = new raydium_sdk_v2_1.Percent(1, 100); // 1%
    const baseIn = true;
    const { execute } = yield raydium.cpmm.addLiquidity({
        poolInfo,
        poolKeys,
        inputAmount,
        slippage,
        baseIn,
        txVersion: config_1.txVersion,
    });
    const { txId } = yield execute({ sendAndConfirm: true });
    console.log('pool deposited', { txId: `https://explorer.solana.com/tx/${txId}` });
    process.exit();
});
exports.deposit = deposit;
(0, exports.deposit)();
//# sourceMappingURL=deposit.js.map