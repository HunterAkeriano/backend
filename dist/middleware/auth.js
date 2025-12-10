"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAuthCache = clearAuthCache;
exports.createAuthMiddleware = createAuthMiddleware;
exports.createOptionalAuthMiddleware = createOptionalAuthMiddleware;
exports.requireAdmin = requireAdmin;
exports.requireModerator = requireModerator;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../config/db");
const apiError_1 = require("../utils/apiError");
const roles_1 = require("../utils/roles");
const AUTH_CACHE_TTL_MS = 60000;
const authCache = new Map();
function getCachedAuthUser(userId) {
    const cached = authCache.get(userId);
    if (!cached)
        return null;
    if (cached.expiresAt < Date.now()) {
        authCache.delete(userId);
        return null;
    }
    return cached.data;
}
function setCachedAuthUser(user) {
    authCache.set(user.id, { data: user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}
function clearAuthCache(userId) {
    authCache.delete(userId);
}
function createAuthMiddleware(env) {
    return async function authMiddleware(req, res, next) {
        const header = req.headers.authorization;
        if (!header) {
            return (0, apiError_1.sendApiError)(res, 401, 'Missing authorization header');
        }
        const [, token] = header.split(' ');
        if (!token) {
            return (0, apiError_1.sendApiError)(res, 401, 'Invalid authorization header');
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, env.JWT_SECRET);
            const cached = getCachedAuthUser(payload.sub);
            if (cached) {
                req.userId = cached.id;
                req.authUser = cached;
                return next();
            }
            const { User } = (0, db_1.getModels)();
            const user = await User.findByPk(payload.sub, {
                attributes: ['id', 'email', 'isAdmin', 'isSuperAdmin', 'isPayment', 'subscriptionTier']
            });
            if (!user) {
                return (0, apiError_1.sendApiError)(res, 401, 'User not found');
            }
            const plain = user.get();
            const roleData = (0, roles_1.resolveUserRole)(env, { email: plain.email, isAdmin: plain.isAdmin, isSuperAdmin: plain.isSuperAdmin });
            req.userId = plain.id;
            req.authUser = {
                id: plain.id,
                role: roleData.role,
                isAdmin: roleData.isAdmin,
                isSuperAdmin: roleData.isSuperAdmin,
                isPayment: Boolean(plain.isPayment),
                subscriptionTier: plain.subscriptionTier ?? 'free'
            };
            setCachedAuthUser(req.authUser);
            next();
        }
        catch {
            (0, apiError_1.sendApiError)(res, 401, 'Invalid or expired token');
        }
    };
}
function createOptionalAuthMiddleware(env) {
    return async function optionalAuthMiddleware(req, res, next) {
        const header = req.headers.authorization;
        if (!header) {
            return next();
        }
        const [, token] = header.split(' ');
        if (!token) {
            return next();
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, env.JWT_SECRET);
            const cached = getCachedAuthUser(payload.sub);
            if (cached) {
                req.userId = cached.id;
                req.authUser = cached;
                return next();
            }
            const { User } = (0, db_1.getModels)();
            const user = await User.findByPk(payload.sub, {
                attributes: ['id', 'email', 'isAdmin', 'isSuperAdmin', 'isPayment', 'subscriptionTier']
            });
            if (user) {
                const plain = user.get();
                const roleData = (0, roles_1.resolveUserRole)(env, { email: plain.email, isAdmin: plain.isAdmin, isSuperAdmin: plain.isSuperAdmin });
                req.userId = plain.id;
                req.authUser = {
                    id: plain.id,
                    role: roleData.role,
                    isAdmin: roleData.isAdmin,
                    isSuperAdmin: roleData.isSuperAdmin,
                    isPayment: Boolean(plain.isPayment),
                    subscriptionTier: plain.subscriptionTier ?? 'free'
                };
                setCachedAuthUser(req.authUser);
            }
        }
        catch {
        }
        next();
    };
}
function requireAdmin(req, res, next) {
    if (!req.authUser?.isAdmin) {
        return (0, apiError_1.sendApiError)(res, 403, 'Admin access required');
    }
    next();
}
function requireModerator(req, res, next) {
    if (!req.authUser?.isAdmin && !req.authUser?.isSuperAdmin) {
        return (0, apiError_1.sendApiError)(res, 403, 'Moderator or admin access required');
    }
    next();
}
//# sourceMappingURL=auth.js.map