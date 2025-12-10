"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const tokens_1 = require("../../utils/tokens");
class TokenService {
    constructor(env) {
        this.env = env;
    }
    issueAccess(userId) {
        return (0, tokens_1.signAccessToken)(this.env, userId);
    }
    issueRefresh() {
        const refreshToken = (0, tokens_1.generateRefreshToken)();
        const refreshHash = (0, tokens_1.hashToken)(refreshToken);
        const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const accessToken = this.issueAccess('');
        return { accessToken, refreshToken, refreshHash, refreshExpires };
    }
    signPair(userId) {
        const refreshToken = (0, tokens_1.generateRefreshToken)();
        const refreshHash = (0, tokens_1.hashToken)(refreshToken);
        const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const accessToken = this.issueAccess(userId);
        return { accessToken, refreshToken, refreshHash, refreshExpires };
    }
    verifyAccess(token) {
        const payload = jsonwebtoken_1.default.verify(token, this.env.JWT_SECRET);
        return payload.sub;
    }
    hashResetToken(token) {
        return crypto_1.default.createHash('sha256').update(token).digest('hex');
    }
}
exports.TokenService = TokenService;
//# sourceMappingURL=token-service.js.map