"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const apiError_1 = require("../../utils/apiError");
const roles_1 = require("../../utils/roles");
class ProfileService {
    constructor(env, users) {
        this.env = env;
        this.users = users;
    }
    attachSuperFlag(user) {
        const roleData = (0, roles_1.resolveUserRole)(this.env, { email: user.email, isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin });
        return { ...user, ...roleData };
    }
    toSafeUser(user) {
        if (!user)
            return null;
        const { passwordHash: _ignored, ...plain } = user.get({ plain: true });
        void _ignored;
        return this.attachSuperFlag(plain);
    }
    getCachedProfile(userId) {
        const cached = ProfileService.cache.get(userId);
        if (!cached)
            return null;
        if (cached.expiresAt < Date.now()) {
            ProfileService.cache.delete(userId);
            return null;
        }
        return cached.user;
    }
    setCachedProfile(userId, user) {
        ProfileService.cache.set(userId, { user, expiresAt: Date.now() + ProfileService.ttl });
    }
    clearCache(userId) {
        ProfileService.cache.delete(userId);
    }
    async getProfile(userId) {
        const cached = this.getCachedProfile(userId);
        if (cached)
            return cached;
        const user = await this.users.findById(userId, [
            'id',
            'email',
            'name',
            'avatarUrl',
            'createdAt',
            'updatedAt',
            'isPayment',
            'subscriptionTier',
            'isAdmin',
            'isSuperAdmin',
            'subscriptionExpiresAt'
        ]);
        const safe = this.toSafeUser(user);
        if (!safe)
            throw (0, apiError_1.toApiError)(404, 'User not found');
        this.setCachedProfile(userId, safe);
        return safe;
    }
    async updateProfile(userId, payload) {
        const user = await this.users.findById(userId);
        if (!user)
            throw (0, apiError_1.toApiError)(404, 'User not found');
        await this.users.update(user, {
            name: payload.name ?? user.name,
            avatarUrl: payload.avatarUrl ?? user.avatarUrl,
            updatedAt: new Date()
        });
        const safe = this.toSafeUser(user);
        if (safe)
            this.setCachedProfile(userId, safe);
        return safe;
    }
    async updateAvatar(userId, fileName, host, protocol) {
        const user = await this.users.findById(userId);
        if (!user)
            throw (0, apiError_1.toApiError)(404, 'User not found');
        const oldAvatarUrl = user.avatarUrl || undefined;
        const avatarUrl = `${protocol}://${host}/uploads/avatars/${fileName}`;
        await this.users.update(user, { avatarUrl, updatedAt: new Date() });
        if (oldAvatarUrl) {
            const oldFileName = oldAvatarUrl.split('/uploads/avatars/')[1];
            if (oldFileName) {
                const filePath = path_1.default.join(__dirname, '../../uploads/avatars', path_1.default.basename(oldFileName));
                promises_1.default.unlink(filePath).catch(() => void 0);
            }
        }
        const safe = this.toSafeUser(user);
        if (safe)
            this.setCachedProfile(userId, safe);
        return { user: safe, avatarUrl };
    }
}
exports.ProfileService = ProfileService;
// Use shared cache so invalidation works across controller instances
ProfileService.cache = new Map();
ProfileService.ttl = 60000;
//# sourceMappingURL=profile-service.js.map