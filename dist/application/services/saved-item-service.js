"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavedItemService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const payloadNormalization_1 = require("../../utils/payloadNormalization");
const apiError_1 = require("../../utils/apiError");
const sequelize_1 = require("sequelize");
class SavedItemService {
    constructor(repo) {
        this.repo = repo;
    }
    toPlain(item) {
        const { user: _user, payloadHash: _hash, ...plain } = item.get({ plain: true });
        void _user;
        void _hash;
        return plain;
    }
    computePayloadHash(category, payload) {
        const normalized = (0, payloadNormalization_1.normalizePayload)(category, payload);
        const serialized = (0, payloadNormalization_1.stableStringify)(normalized);
        return crypto_1.default.createHash('md5').update(serialized).digest('hex');
    }
    async enforceLimit(req) {
        const total = await this.repo.countByUser(req.userId);
        const tier = req.authUser?.subscriptionTier || (req.authUser?.isPayment ? 'pro' : 'free');
        const limit = tier === 'premium' ? Infinity : tier === 'pro' ? 50 : 5;
        if (total >= limit) {
            throw (0, apiError_1.toApiError)(403, 'Storage limit reached', { details: { limit } });
        }
    }
    async list(category, userId) {
        const items = await this.repo.findAllByUser(category, userId);
        return items.map((i) => this.toPlain(i));
    }
    async listPublic(category) {
        const items = await this.repo.findPublic(category);
        return items.map((item) => {
            const { user, ...plain } = item.get({ plain: true });
            const owner = user;
            return {
                ...plain,
                ownerName: owner?.name ?? null,
                ownerEmail: owner?.email ?? null,
                ownerAvatar: owner?.avatarUrl ?? null
            };
        });
    }
    async create(category, req, payload) {
        await this.enforceLimit(req);
        const payloadHash = this.computePayloadHash(category, payload.data);
        const existing = await this.repo.findOne(category, { userId: req.userId, payloadHash });
        if (existing) {
            throw (0, apiError_1.toApiError)(409, 'Already saved');
        }
        const created = await this.repo.create(category, {
            userId: req.userId,
            name: payload.name,
            payload: payload.data,
            payloadHash,
            status: 'private'
        });
        return this.toPlain(created);
    }
    async requestPublish(category, req, id) {
        const item = await this.repo.findOne(category, { id, userId: req.userId, status: 'private' });
        if (!item) {
            throw (0, apiError_1.toApiError)(404, 'Item not found or already published');
        }
        const payloadHash = item.payloadHash || this.computePayloadHash(category, item.payload);
        if (!item.payloadHash) {
            await item.update({ payloadHash });
        }
        const duplicate = await this.repo.findOne(category, {
            status: { [sequelize_1.Op.in]: ['approved', 'pending'] },
            payloadHash
        });
        if (duplicate) {
            throw (0, apiError_1.toApiError)(409, 'This item already exists in public collection');
        }
        await item.update({ status: 'pending', payloadHash });
        return this.toPlain(item);
    }
    async remove(category, req, id) {
        await this.repo.destroy(category, { id, userId: req.userId });
    }
}
exports.SavedItemService = SavedItemService;
//# sourceMappingURL=saved-item-service.js.map