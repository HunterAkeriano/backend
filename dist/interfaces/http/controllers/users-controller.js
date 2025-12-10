"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const auth_1 = require("../../../middleware/auth");
const user_repository_1 = require("../../../infrastructure/repositories/user-repository");
const user_service_1 = require("../../../application/services/user-service");
const apiError_1 = require("../../../utils/apiError");
class UsersController {
    constructor(env, models) {
        this.env = env;
        this.basePath = '/users';
        this.auth = (0, auth_1.createAuthMiddleware)(this.env);
        this.service = new user_service_1.UserService(env, new user_repository_1.UserRepository(models), models);
    }
    register(router) {
        router.get('/public', (req, res) => this.handleList(req, res, true));
        router.get('/', this.auth, auth_1.requireAdmin, (req, res) => this.handleList(req, res, false));
        router.put('/:id', this.auth, auth_1.requireAdmin, async (req, res) => {
            const { id } = req.params;
            if (!id)
                return (0, apiError_1.sendApiError)(res, 400, 'User id is required');
            try {
                const user = await this.service.updateUser(id, req.body || {});
                res.json({ user });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                if (err?.code === '23505')
                    return (0, apiError_1.sendApiError)(res, 400, 'Email already in use');
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to update user');
            }
        });
        router.delete('/:id', this.auth, auth_1.requireAdmin, async (req, res) => {
            const { id } = req.params;
            if (!id)
                return (0, apiError_1.sendApiError)(res, 400, 'User id is required');
            try {
                await this.service.deleteUser(id);
                res.status(204).send();
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to delete user');
            }
        });
    }
    normalizeQuery(req) {
        const allowedTiers = ['all', 'free', 'pro', 'premium'];
        const allowedSortFields = ['name', 'email', 'createdat', 'subscriptiontier'];
        const page = Math.max(1, parseInt(req.query.page ?? '') || 1);
        const limitParam = parseInt(req.query.limit ?? '');
        const limit = Math.min(100, Math.max(1, isNaN(limitParam) ? 20 : limitParam));
        const tier = (req.query.tier ?? 'all').toLowerCase();
        const sortBy = (req.query.sortBy ?? 'createdAt').toLowerCase();
        const sortOrder = (req.query.sortOrder ?? 'desc').toLowerCase();
        const sanitizedTier = allowedTiers.includes(tier) ? tier : 'all';
        const sanitizedSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdat';
        const sanitizedSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
        return { page, limit, tier: sanitizedTier, sortBy: sanitizedSortBy, sortOrder: sanitizedSortOrder };
    }
    async handleList(req, res, hideSuperAdmin = false) {
        try {
            const payload = await this.service.fetchUsers(this.normalizeQuery(req), { hideSuperAdmin });
            res.json(payload);
        }
        catch (err) {
            console.error('Failed to load users:', err);
            return (0, apiError_1.sendApiError)(res, 500, 'Failed to load users');
        }
    }
}
exports.UsersController = UsersController;
//# sourceMappingURL=users-controller.js.map