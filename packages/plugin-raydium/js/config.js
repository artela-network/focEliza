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
exports.grpcToken = exports.grpcUrl = exports.fetchTokenAccountData = exports.initSdk = exports.txVersion = exports.connection = exports.owner = void 0;
const raydium_sdk_v2_1 = require("@raydium-io/raydium-sdk-v2");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const bs58_1 = __importDefault(require("bs58"));
exports.owner = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode('XXXX'));
exports.connection = new web3_js_1.Connection('https://api.devnet.solana.com');
exports.txVersion = raydium_sdk_v2_1.TxVersion.V0; // or TxVersion.LEGACY
const cluster = 'devnet'; // 'mainnet' | 'devnet'
let raydium;
const initSdk = (params) => __awaiter(void 0, void 0, void 0, function* () {
    if (raydium)
        return raydium;
    if (exports.connection.rpcEndpoint === (0, web3_js_1.clusterApiUrl)('mainnet-beta'))
        console.warn('using free rpc node might cause unexpected error, strongly suggest uses paid rpc node');
    console.log(`connect to rpc ${exports.connection.rpcEndpoint} in ${cluster}`);
    raydium = yield raydium_sdk_v2_1.Raydium.load({
        owner: exports.owner,
        connection: exports.connection,
        cluster,
        disableFeatureCheck: true,
        disableLoadToken: !(params === null || params === void 0 ? void 0 : params.loadToken),
        blockhashCommitment: 'finalized',
    });
    return raydium;
});
exports.initSdk = initSdk;
const fetchTokenAccountData = () => __awaiter(void 0, void 0, void 0, function* () {
    const solAccountResp = yield exports.connection.getAccountInfo(exports.owner.publicKey);
    const tokenAccountResp = yield exports.connection.getTokenAccountsByOwner(exports.owner.publicKey, { programId: spl_token_1.TOKEN_PROGRAM_ID });
    const token2022Req = yield exports.connection.getTokenAccountsByOwner(exports.owner.publicKey, { programId: spl_token_1.TOKEN_2022_PROGRAM_ID });
    const tokenAccountData = (0, raydium_sdk_v2_1.parseTokenAccountResp)({
        owner: exports.owner.publicKey,
        solAccountResp,
        tokenAccountResp: {
            context: tokenAccountResp.context,
            value: [...tokenAccountResp.value, ...token2022Req.value],
        },
    });
    return tokenAccountData;
});
exports.fetchTokenAccountData = fetchTokenAccountData;
exports.grpcUrl = '<YOUR_GRPC_URL>';
exports.grpcToken = '<YOUR_GRPC_TOKEN>';
//# sourceMappingURL=config.js.map