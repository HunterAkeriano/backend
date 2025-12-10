"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const sequelize_1 = require("sequelize");
const apiError_1 = require("../../utils/apiError");
const roles_1 = require("../../utils/roles");
const sortFieldMap = {
    name: `COALESCE(NULLIF(name, ''), split_part(email, '@', 1))`,
    email: 'email',
    createdat: 'created_at',
    subscriptiontier: 'subscription_tier'
};
class UserService {
    constructor(env, users, models) {
        this.env = env;
        this.users = users;
        this.models = models;
        this.superAdminEmail = env.SUPER_ADMIN_EMAIL.toLowerCase();
    }
    serializeUser(user, options = {}) {
        const { passwordHash: _ignored, ...rest } = user.get({ plain: true });
        void _ignored;
        const roleData = (0, roles_1.resolveUserRole)(this.env, rest);
        const serialized = { ...rest, ...roleData };
        if (options.hideSuperAdmin) {
            delete serialized.isSuperAdmin;
        }
        return serialized;
    }
    async fetchUsers(options, extra) {
        const offset = (options.page - 1) * options.limit;
        const whereConditions = [(0, sequelize_1.where)((0, sequelize_1.fn)('LOWER', (0, sequelize_1.col)('email')), { [sequelize_1.Op.ne]: this.superAdminEmail })];
        if (options.tier !== 'all') {
            whereConditions.push({ subscriptionTier: options.tier });
        }
        const whereClause = { [sequelize_1.Op.and]: whereConditions };
        const sortField = sortFieldMap[options.sortBy] || 'created_at';
        const sortDirection = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
        const total = await this.users.findUsers({
            limit: options.limit,
            offset,
            search: undefined,
            attributes: ['id']
        }).then((res) => res.count);
        const ordered = await this.models.User.findAll({
            where: whereClause,
            attributes: [
                'id',
                'email',
                'name',
                'avatarUrl',
                'subscriptionTier',
                'subscriptionExpiresAt',
                'createdAt',
                'isAdmin',
                'isSuperAdmin'
            ],
            order: [
                [
                    (0, sequelize_1.literal)(`CASE WHEN "subscription_tier" = 'premium' THEN 1 WHEN "subscription_tier" = 'pro' THEN 2 WHEN "subscription_tier" = 'free' THEN 3 ELSE 4 END`),
                    'ASC'
                ],
                [(0, sequelize_1.literal)(sortField), sortDirection]
            ],
            limit: options.limit,
            offset
        });
        return {
            users: ordered.map((u) => this.serializeUser(u, { hideSuperAdmin: extra?.hideSuperAdmin })),
            pagination: {
                page: options.page,
                limit: options.limit,
                total,
                totalPages: Math.ceil(total / options.limit),
                hasMore: offset + options.limit < total
            }
        };
    }
    async updateUser(id, payload) {
        const user = await this.users.findById(id);
        if (!user)
            throw (0, apiError_1.toApiError)(404, 'User not found');
        const updates = {};
        if (payload.email)
            updates.email = payload.email;
        if (payload.name !== undefined)
            updates.name = payload.name;
        if (payload.subscriptionTier) {
            const tier = payload.subscriptionTier;
            updates.subscriptionTier = tier;
            updates.isPayment = tier !== 'free';
            if (tier === 'free') {
                updates.subscriptionExpiresAt = null;
            }
            else if (payload.subscriptionDuration === 'month') {
                updates.subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            }
            else if (payload.subscriptionDuration === 'forever') {
                updates.subscriptionExpiresAt = new Date('2100-01-01T00:00:00Z');
            }
        }
        if (payload.password) {
            updates.passwordHash = await bcryptjs_1.default.hash(payload.password, 10);
        }
        if (payload.role !== undefined) {
            const allowedRoles = ['user', 'moderator', 'super_admin'];
            if (!allowedRoles.includes(payload.role)) {
                throw (0, apiError_1.toApiError)(400, 'Invalid role');
            }
            const flags = (0, roles_1.roleToFlags)(payload.role);
            updates.isAdmin = flags.isAdmin;
            updates.isSuperAdmin = flags.isSuperAdmin;
        }
        if (!Object.keys(updates).length) {
            throw (0, apiError_1.toApiError)(400, 'Nothing to update');
        }
        updates.updatedAt = new Date();
        await this.users.update(user, updates);
        return this.serializeUser(user);
    }
    async deleteUser(id) {
        const deleted = await this.users.models.User.destroy({ where: { id } });
        if (!deleted)
            throw (0, apiError_1.toApiError)(404, 'User not found');
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user-service.js.map