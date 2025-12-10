"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavedItemRepository = void 0;
const sequelize_1 = require("sequelize");
class SavedItemRepository {
    constructor(models, env) {
        this.models = models;
        this.env = env;
        this.modelMap = {
            gradient: models.SavedGradient,
            shadow: models.SavedShadow,
            animation: models.SavedAnimation,
            'clip-path': models.SavedClipPath,
            favicon: models.SavedFavicon
        };
    }
    model(category) {
        return this.modelMap[category];
    }
    countByUser(userId) {
        return Promise.all([
            this.models.SavedGradient.count({ where: { userId } }),
            this.models.SavedShadow.count({ where: { userId } }),
            this.models.SavedAnimation.count({ where: { userId } }),
            this.models.SavedClipPath.count({ where: { userId } }),
            this.models.SavedFavicon.count({ where: { userId } })
        ]).then(([g, s, a, c, f]) => g + s + a + c + f);
    }
    findAllByUser(category, userId) {
        return this.model(category).findAll({
            where: { userId },
            order: [['createdAt', 'DESC']]
        });
    }
    findAllByStatus(category, status) {
        return this.model(category).findAll({
            where: { status },
            order: [['createdAt', 'DESC']]
        });
    }
    findPublic(category) {
        const model = this.model(category);
        const baseConditions = { status: 'approved' };
        const whereConditions = category !== 'clip-path'
            ? {
                ...baseConditions,
                [sequelize_1.Op.and]: [
                    {
                        [sequelize_1.Op.or]: [
                            { '$user.email$': null },
                            (0, sequelize_1.where)((0, sequelize_1.fn)('LOWER', (0, sequelize_1.col)('user.email')), { [sequelize_1.Op.ne]: this.env.SUPER_ADMIN_EMAIL.toLowerCase() })
                        ]
                    }
                ]
            }
            : baseConditions;
        return model.findAll({
            where: whereConditions,
            include: [{ model: this.models.User, as: 'user', attributes: ['name', 'email', 'avatarUrl'], required: false }],
            order: [
                ['isFeatured', 'DESC'],
                [(0, sequelize_1.literal)('"approved_at"'), 'DESC'],
                ['createdAt', 'DESC']
            ],
            limit: 50
        });
    }
    create(category, payload) {
        return this.model(category).create(payload);
    }
    findOne(category, whereClause) {
        return this.model(category).findOne({ where: whereClause });
    }
    destroy(category, whereClause) {
        return this.model(category).destroy({ where: whereClause });
    }
}
exports.SavedItemRepository = SavedItemRepository;
//# sourceMappingURL=saved-item-repository.js.map