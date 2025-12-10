"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetRepository = void 0;
const sequelize_1 = require("sequelize");
class PasswordResetRepository {
    constructor(models) {
        this.models = models;
    }
    create(payload) {
        return this.models.PasswordReset.create(payload);
    }
    findValid(tokenHash, now = new Date()) {
        return this.models.PasswordReset.findOne({
            where: {
                tokenHash,
                used: false,
                expiresAt: { [sequelize_1.Op.gt]: now }
            }
        });
    }
    markUsed(reset) {
        return reset.update({ used: true });
    }
}
exports.PasswordResetRepository = PasswordResetRepository;
//# sourceMappingURL=password-reset-repository.js.map