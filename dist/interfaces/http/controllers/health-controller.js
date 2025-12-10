"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
class HealthController {
    constructor() {
        this.basePath = '/health';
    }
    register(router) {
        router.get('/', (_req, res) => res.json({ status: 'ok' }));
    }
}
exports.HealthController = HealthController;
//# sourceMappingURL=health-controller.js.map