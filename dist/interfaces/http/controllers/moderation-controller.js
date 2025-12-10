"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationController = void 0;
const auth_1 = require("../../../middleware/auth");
const saved_item_repository_1 = require("../../../infrastructure/repositories/saved-item-repository");
const moderation_service_1 = require("../../../application/services/moderation-service");
const apiError_1 = require("../../../utils/apiError");
class ModerationController {
    constructor(env, models) {
        this.env = env;
        this.basePath = '/moderation';
        this.auth = (0, auth_1.createAuthMiddleware)(this.env);
        this.validCategories = ['gradient', 'shadow', 'animation', 'clip-path', 'favicon'];
        this.service = new moderation_service_1.ModerationService(new saved_item_repository_1.SavedItemRepository(models, env));
    }
    isValidCategory(category) {
        return this.validCategories.includes(category);
    }
    isValidId(id) {
        if (!id || id.trim().length === 0)
            return false;
        if (id.includes('..') || id.includes('\0') || id.includes('%00'))
            return false;
        if (id === 'null' || id === 'undefined')
            return false;
        return true;
    }
    register(router) {
        router.get('/pending', this.auth, auth_1.requireAdmin, async (_req, res) => {
            try {
                const items = await this.service.listByStatus('pending');
                res.json({ items });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to fetch pending items');
            }
        });
        router.get('/approved', this.auth, auth_1.requireAdmin, async (_req, res) => {
            try {
                const items = await this.service.listByStatus('approved');
                res.json({ items });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to fetch approved items');
            }
        });
        router.post('/:category/:id/approve', this.auth, auth_1.requireAdmin, async (req, res) => {
            const category = req.params.category;
            if (!this.isValidCategory(category)) {
                return (0, apiError_1.sendApiError)(res, 400, 'Invalid category');
            }
            if (!this.isValidId(req.params.id)) {
                return (0, apiError_1.sendApiError)(res, 400, 'Invalid item ID');
            }
            try {
                const item = await this.service.approve(category, req.params.id);
                res.json({ item });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to approve item');
            }
        });
        router.put('/:category/:id', this.auth, auth_1.requireAdmin, async (req, res) => {
            const category = req.params.category;
            if (!this.isValidCategory(category)) {
                return (0, apiError_1.sendApiError)(res, 400, 'Invalid category');
            }
            if (!this.isValidId(req.params.id)) {
                return (0, apiError_1.sendApiError)(res, 400, 'Invalid item ID');
            }
            const { name } = req.body;
            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                return (0, apiError_1.sendApiError)(res, 400, 'Name is required');
            }
            try {
                const item = await this.service.rename(category, req.params.id, name);
                res.json({ item });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to update item');
            }
        });
        router.delete('/:category/:id', this.auth, auth_1.requireAdmin, async (req, res) => {
            const category = req.params.category;
            if (!this.isValidCategory(category)) {
                return (0, apiError_1.sendApiError)(res, 400, 'Invalid category');
            }
            if (!this.isValidId(req.params.id)) {
                return (0, apiError_1.sendApiError)(res, 400, 'Invalid item ID');
            }
            try {
                await this.service.remove(category, req.params.id);
                res.json({ success: true });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to delete item');
            }
        });
    }
}
exports.ModerationController = ModerationController;
//# sourceMappingURL=moderation-controller.js.map