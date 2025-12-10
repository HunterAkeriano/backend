"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationService = void 0;
const apiError_1 = require("../../utils/apiError");
class ModerationService {
    constructor(repo) {
        this.repo = repo;
    }
    toItem(item, category) {
        return { ...item.get({ plain: true }), category };
    }
    async listByStatus(status) {
        const [gradients, shadows, animations, clipPaths, favicons] = await Promise.all([
            this.repo.findAllByStatus('gradient', status),
            this.repo.findAllByStatus('shadow', status),
            this.repo.findAllByStatus('animation', status),
            this.repo.findAllByStatus('clip-path', status),
            this.repo.findAllByStatus('favicon', status)
        ]);
        const mapCategory = (cat, list) => list.map((item) => this.toItem(item, cat));
        const items = [
            ...mapCategory('gradient', gradients),
            ...mapCategory('shadow', shadows),
            ...mapCategory('animation', animations),
            ...mapCategory('clip-path', clipPaths),
            ...mapCategory('favicon', favicons)
        ];
        const sortField = status === 'pending' ? 'createdAt' : 'approvedAt';
        items.sort((a, b) => new Date(b[sortField] ?? 0).getTime() - new Date(a[sortField] ?? 0).getTime());
        return items;
    }
    async findItem(category, id) {
        const item = await this.repo.findOne(category, { id });
        if (!item)
            throw (0, apiError_1.toApiError)(404, 'Item not found');
        return item;
    }
    async approve(category, id) {
        const item = await this.findItem(category, id);
        await item.update({ status: 'approved', isFeatured: true, approvedAt: new Date() });
        return this.toItem(item, category);
    }
    async rename(category, id, name) {
        const item = await this.repo.findOne(category, { id, status: 'approved' });
        if (!item)
            throw (0, apiError_1.toApiError)(404, 'Item not found or not approved');
        await item.update({ name });
        return this.toItem(item, category);
    }
    async remove(category, id) {
        const deleted = await this.repo.destroy(category, { id, status: 'approved' });
        if (!deleted)
            throw (0, apiError_1.toApiError)(404, 'Item not found or not approved');
    }
}
exports.ModerationService = ModerationService;
//# sourceMappingURL=moderation-service.js.map