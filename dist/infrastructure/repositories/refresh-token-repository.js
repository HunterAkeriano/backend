"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshTokenRepository = void 0;
const sequelize_1 = require("sequelize");
class RefreshTokenRepository {
    constructor(models) {
        this.models = models;
    }
    create(payload) {
        return this.models.RefreshToken.create(payload);
    }
    findValid(tokenHash, now = new Date()) {
        return this.models.RefreshToken.findOne({
            where: {
                tokenHash,
                revoked: false,
                expiresAt: { [sequelize_1.Op.gt]: now }
            }
        });
    }
    revokeByHash(tokenHash) {
        return this.models.RefreshToken.update({ revoked: true }, { where: { tokenHash } });
    }
}
exports.RefreshTokenRepository = RefreshTokenRepository;
//# sourceMappingURL=refresh-token-repository.js.map