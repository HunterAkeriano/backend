"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const apiError_1 = require("../../utils/apiError");
const roles_1 = require("../../utils/roles");
class AuthService {
    constructor(env, users, refreshTokens, resets, tokenService) {
        this.env = env;
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.resets = resets;
        this.tokenService = tokenService;
    }
    attachSuperFlag(user) {
        const roleData = (0, roles_1.resolveUserRole)(this.env, { email: user.email, isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin });
        return { ...user, ...roleData };
    }
    toSafeUser(user) {
        if (!user)
            return null;
        const { passwordHash: _ignored, ...rest } = user.get({ plain: true });
        void _ignored;
        return this.attachSuperFlag(rest);
    }
    async register(payload) {
        const existing = await this.users.findByEmail(payload.email);
        if (existing) {
            throw (0, apiError_1.toApiError)(409, 'User already exists');
        }
        const passwordHash = await bcryptjs_1.default.hash(payload.password, 10);
        const user = await this.users.create({
            email: payload.email.toLowerCase(),
            passwordHash,
            name: payload.name ?? null
        });
        const tokens = this.tokenService.signPair(user.id);
        await this.refreshTokens.create({
            userId: user.id,
            tokenHash: tokens.refreshHash,
            expiresAt: tokens.refreshExpires,
            revoked: false
        });
        return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: this.toSafeUser(user) };
    }
    async login(payload) {
        const user = await this.users.findByEmail(payload.email, [
            'id',
            'email',
            'passwordHash',
            'name',
            'avatarUrl',
            'createdAt',
            'isPayment',
            'isAdmin',
            'isSuperAdmin',
            'subscriptionTier',
            'subscriptionExpiresAt'
        ]);
        if (!user)
            throw (0, apiError_1.toApiError)(401, 'Invalid credentials');
        const valid = await bcryptjs_1.default.compare(payload.password, user.passwordHash);
        if (!valid)
            throw (0, apiError_1.toApiError)(401, 'Invalid credentials');
        const tokens = this.tokenService.signPair(user.id);
        await this.refreshTokens.create({
            userId: user.id,
            tokenHash: tokens.refreshHash,
            expiresAt: tokens.refreshExpires,
            revoked: false
        });
        return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: this.toSafeUser(user) };
    }
    async refresh(refreshToken) {
        const tokenHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
        const record = await this.refreshTokens.findValid(tokenHash);
        if (!record) {
            throw (0, apiError_1.toApiError)(401, 'Invalid refresh token');
        }
        const user = await this.users.findById(record.userId, [
            'id',
            'email',
            'name',
            'avatarUrl',
            'subscriptionTier',
            'subscriptionExpiresAt',
            'isPayment',
            'isAdmin',
            'isSuperAdmin',
            'createdAt'
        ]);
        if (!user)
            throw (0, apiError_1.toApiError)(401, 'Invalid refresh token');
        const accessToken = this.tokenService.issueAccess(user.id);
        return { accessToken, user: this.toSafeUser(user) };
    }
    async logout(refreshToken) {
        if (!refreshToken)
            return;
        const tokenHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
        await this.refreshTokens.revokeByHash(tokenHash);
    }
    async forgotPassword(email) {
        const user = await this.users.findByEmail(email, ['id', 'email']);
        if (!user)
            throw (0, apiError_1.toApiError)(404, 'Email not found');
        const token = crypto_1.default.randomBytes(24).toString('hex');
        const tokenHash = this.tokenService.hashResetToken(token);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await this.resets.create({
            userId: user.id,
            tokenHash,
            expiresAt,
            used: false
        });
        return { token, userEmail: user.email };
    }
    async resetPassword(payload) {
        const tokenHash = this.tokenService.hashResetToken(payload.token);
        const reset = await this.resets.findValid(tokenHash);
        if (!reset)
            throw (0, apiError_1.toApiError)(400, 'Invalid or expired token');
        const user = await this.users.findById(reset.userId, ['id', 'passwordHash']);
        if (!user)
            throw (0, apiError_1.toApiError)(400, 'Invalid or expired token');
        const newHash = await bcryptjs_1.default.hash(payload.password, 10);
        await this.users.update(user, { passwordHash: newHash, updatedAt: new Date() });
        await this.resets.markUsed(reset);
    }
    async changePassword(payload) {
        const user = await this.users.findById(payload.userId, ['id', 'passwordHash']);
        if (!user)
            throw (0, apiError_1.toApiError)(401, 'User not found');
        const valid = await bcryptjs_1.default.compare(payload.currentPassword, user.passwordHash);
        if (!valid)
            throw (0, apiError_1.toApiError)(400, 'Invalid current password');
        const newHash = await bcryptjs_1.default.hash(payload.newPassword, 10);
        await this.users.update(user, { passwordHash: newHash, updatedAt: new Date() });
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth-service.js.map