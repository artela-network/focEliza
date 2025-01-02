"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidCpmm = void 0;
const raydium_sdk_v2_1 = require("@raydium-io/raydium-sdk-v2");
const VALID_PROGRAM_ID = new Set([raydium_sdk_v2_1.CREATE_CPMM_POOL_PROGRAM.toBase58(), raydium_sdk_v2_1.DEV_CREATE_CPMM_POOL_PROGRAM.toBase58()]);
const isValidCpmm = (id) => VALID_PROGRAM_ID.has(id);
exports.isValidCpmm = isValidCpmm;
//# sourceMappingURL=utils.js.map