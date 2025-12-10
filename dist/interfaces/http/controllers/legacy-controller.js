"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegacyController = void 0;
/**
 * Adapter that wraps existing function-based routers into the HttpController interface.
 * Helps transition to the class-based router composition without rewriting all handlers at once.
 */
class LegacyController {
    constructor(path, factory, env) {
        this.path = path;
        this.factory = factory;
        this.env = env;
        this.basePath = path;
    }
    register(router) {
        router.use(this.factory(this.env));
    }
}
exports.LegacyController = LegacyController;
//# sourceMappingURL=legacy-controller.js.map