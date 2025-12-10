"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiRouter = void 0;
const express_1 = require("express");
/**
 * Aggregates controllers and exposes a single Router.
 * Implements a simple Composite + Builder pattern.
 */
class ApiRouter {
    constructor(env, controllers) {
        this.env = env;
        this.controllers = controllers;
    }
    build() {
        const router = (0, express_1.Router)();
        const sorted = [...this.controllers].sort((a, b) => (a.basePath === '/health' ? -1 : b.basePath === '/health' ? 1 : 0));
        for (const controller of sorted) {
            const child = (0, express_1.Router)();
            controller.register(child);
            router.use(controller.basePath, child);
        }
        return router;
    }
}
exports.ApiRouter = ApiRouter;
//# sourceMappingURL=api-router.js.map