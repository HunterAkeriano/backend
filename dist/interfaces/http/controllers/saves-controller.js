"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavesController = void 0;
const zod_1 = require("zod");
const auth_1 = require("../../../middleware/auth");
const saved_item_repository_1 = require("../../../infrastructure/repositories/saved-item-repository");
const saved_item_service_1 = require("../../../application/services/saved-item-service");
const apiError_1 = require("../../../utils/apiError");
const saveSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(120),
    payload: zod_1.z.record(zod_1.z.any())
});
class SavesController {
    constructor(env, models) {
        this.env = env;
        this.basePath = '/saves';
        this.authMiddleware = (0, auth_1.createAuthMiddleware)(env);
        this.service = new saved_item_service_1.SavedItemService(new saved_item_repository_1.SavedItemRepository(models, env));
    }
    register(router) {
        router.get('/gradients', this.authMiddleware, (req, res) => this.list('gradient', req, res));
        router.get('/public/gradients', (req, res) => this.listPublic('gradient', req, res));
        router.post('/gradients', this.authMiddleware, (req, res) => this.create('gradient', req, res));
        router.post('/gradients/:id/publish', this.authMiddleware, (req, res) => this.publish('gradient', req, res));
        router.delete('/gradients/:id', this.authMiddleware, (req, res) => this.remove('gradient', req, res));
        router.get('/shadows', this.authMiddleware, (req, res) => this.list('shadow', req, res));
        router.get('/public/shadows', (req, res) => this.listPublic('shadow', req, res));
        router.post('/shadows', this.authMiddleware, (req, res) => this.create('shadow', req, res));
        router.post('/shadows/:id/publish', this.authMiddleware, (req, res) => this.publish('shadow', req, res));
        router.delete('/shadows/:id', this.authMiddleware, (req, res) => this.remove('shadow', req, res));
        router.get('/animations', this.authMiddleware, (req, res) => this.list('animation', req, res));
        router.get('/public/animations', (req, res) => this.listPublic('animation', req, res));
        router.post('/animations', this.authMiddleware, (req, res) => this.create('animation', req, res));
        router.post('/animations/:id/publish', this.authMiddleware, (req, res) => this.publish('animation', req, res));
        router.delete('/animations/:id', this.authMiddleware, (req, res) => this.remove('animation', req, res));
        router.get('/clip-paths', this.authMiddleware, (req, res) => this.list('clip-path', req, res));
        router.get('/public/clip-paths', (req, res) => this.listPublic('clip-path', req, res));
        router.post('/clip-paths', this.authMiddleware, (req, res) => this.create('clip-path', req, res));
        router.post('/clip-paths/:id/publish', this.authMiddleware, (req, res) => this.publish('clip-path', req, res));
        router.delete('/clip-paths/:id', this.authMiddleware, (req, res) => this.remove('clip-path', req, res));
        router.get('/favicons', this.authMiddleware, (req, res) => this.list('favicon', req, res));
        router.get('/public/favicons', (req, res) => this.listPublic('favicon', req, res));
        router.post('/favicons', this.authMiddleware, (req, res) => this.create('favicon', req, res));
        router.post('/favicons/:id/publish', this.authMiddleware, (req, res) => this.publish('favicon', req, res));
        router.delete('/favicons/:id', this.authMiddleware, (req, res) => this.remove('favicon', req, res));
    }
    async list(category, req, res) {
        try {
            const items = await this.service.list(category, req.userId);
            res.json({ items });
        }
        catch (err) {
            if (err?.status)
                return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
            return (0, apiError_1.sendApiError)(res, 500, 'Failed to load items');
        }
    }
    async listPublic(category, _req, res) {
        try {
            const items = await this.service.listPublic(category);
            res.json({ items });
        }
        catch (err) {
            if (err?.status)
                return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
            return (0, apiError_1.sendApiError)(res, 500, 'Failed to load items');
        }
    }
    async create(category, req, res) {
        const parsed = saveSchema.safeParse(req.body);
        if (!parsed.success) {
            return (0, apiError_1.sendApiError)(res, 400, 'Invalid payload', { details: parsed.error.issues });
        }
        try {
            const item = await this.service.create(category, req, {
                name: parsed.data.name,
                data: parsed.data.payload
            });
            res.status(201).json({ item });
        }
        catch (err) {
            if (err?.status)
                return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
            return (0, apiError_1.sendApiError)(res, 500, 'Failed to save item');
        }
    }
    async publish(category, req, res) {
        try {
            const item = await this.service.requestPublish(category, req, req.params.id);
            res.json({ item });
        }
        catch (err) {
            if (err?.status)
                return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
            return (0, apiError_1.sendApiError)(res, 500, 'Failed to publish item');
        }
    }
    async remove(category, req, res) {
        try {
            await this.service.remove(category, req, req.params.id);
            res.status(204).send();
        }
        catch (err) {
            if (err?.status)
                return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
            return (0, apiError_1.sendApiError)(res, 500, 'Failed to delete item');
        }
    }
}
exports.SavesController = SavesController;
//# sourceMappingURL=saves-controller.js.map