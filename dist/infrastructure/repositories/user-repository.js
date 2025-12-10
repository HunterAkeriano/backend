"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const sequelize_1 = require("sequelize");
class UserRepository {
    constructor(models) {
        this.models = models;
    }
    findById(id, attributes) {
        return this.models.User.findByPk(id, { attributes: attributes });
    }
    findByEmail(email, attributes) {
        return this.models.User.findOne({
            where: { email: email.toLowerCase() },
            attributes: attributes
        });
    }
    create(payload) {
        return this.models.User.create(payload);
    }
    update(user, patch) {
        return user.update(patch);
    }
    countById(id) {
        return this.models.User.count({ where: { id } });
    }
    findUsers(options) {
        const where = options.search
            ? {
                [sequelize_1.Op.or]: [
                    { email: { [sequelize_1.Op.iLike]: `%${options.search}%` } },
                    { name: { [sequelize_1.Op.iLike]: `%${options.search}%` } }
                ]
            }
            : undefined;
        return this.models.User.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: options.limit,
            offset: options.offset,
            attributes: options.attributes
        });
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=user-repository.js.map