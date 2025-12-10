"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForumRepository = void 0;
const sequelize_1 = require("sequelize");
class ForumRepository {
    constructor(models) {
        this.models = models;
    }
    listTopics(options) {
        const where = {};
        if (options.status) {
            where.status = options.status;
        }
        return this.models.ForumTopic.findAndCountAll({
            where,
            order: [
                [{ model: this.models.ForumPinnedTopic, as: 'pin' }, 'createdAt', 'DESC'],
                ['lastActivityAt', 'DESC'],
                ['createdAt', 'DESC']
            ],
            distinct: true,
            col: 'id',
            limit: options.limit,
            offset: (options.page - 1) * options.limit,
            include: [
                {
                    model: this.models.ForumPinnedTopic,
                    as: 'pin',
                    attributes: ['id', 'createdAt', 'createdBy'],
                    required: false
                },
                {
                    model: this.models.User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'avatarUrl', 'isAdmin', 'subscriptionTier']
                }
            ]
        });
    }
    createTopic(payload) {
        return this.models.ForumTopic.create(payload);
    }
    findTopicById(id) {
        return this.models.ForumTopic.findByPk(id, {
            include: [
                {
                    model: this.models.ForumPinnedTopic,
                    as: 'pin',
                    attributes: ['id', 'createdAt', 'createdBy'],
                    required: false
                },
                {
                    model: this.models.User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'avatarUrl', 'isAdmin', 'subscriptionTier']
                }
            ]
        });
    }
    updateTopic(topic, patch) {
        return topic.update(patch);
    }
    findMessageById(id) {
        return this.models.ForumMessage.findByPk(id, {
            include: [
                {
                    model: this.models.User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'avatarUrl', 'isAdmin', 'subscriptionTier']
                }
            ]
        });
    }
    listMessages(topicId) {
        return this.models.ForumMessage.findAll({
            where: { topicId },
            order: [
                ['createdAt', 'ASC'],
                ['id', 'ASC']
            ],
            include: [
                {
                    model: this.models.User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'avatarUrl', 'isAdmin', 'subscriptionTier']
                },
                { model: this.models.ForumMessage, as: 'parent', attributes: ['id', 'userId'] }
            ]
        });
    }
    createMessage(payload) {
        return this.models.ForumMessage.create(payload);
    }
    deleteMessagesByUser(topicId, userId) {
        return this.models.ForumMessage.destroy({
            where: { topicId, userId }
        });
    }
    findUserOpenTopics(userId) {
        return this.models.ForumTopic.findAll({
            where: {
                userId,
                status: ['open', 'in_review']
            },
            attributes: ['id', 'status'],
            order: [['lastActivityAt', 'DESC']]
        });
    }
    pinTopic(topicId, createdBy) {
        return this.models.ForumPinnedTopic.upsert({ topicId, createdBy });
    }
    unpinTopic(topicId) {
        return this.models.ForumPinnedTopic.destroy({ where: { topicId } });
    }
    listPinnedTopics(limit) {
        return this.models.ForumPinnedTopic.findAll({
            order: [['createdAt', 'DESC']],
            limit,
            include: [
                {
                    model: this.models.ForumTopic,
                    as: 'topic',
                    include: [
                        {
                            model: this.models.User,
                            as: 'user',
                            attributes: ['id', 'name', 'email', 'avatarUrl', 'isAdmin', 'subscriptionTier']
                        }
                    ]
                }
            ]
        });
    }
    createMute(payload) {
        return this.models.ForumMute.create(payload);
    }
    findActiveMute(userId) {
        return this.models.ForumMute.findOne({
            where: {
                userId,
                [sequelize_1.Op.or]: [
                    { expiresAt: null },
                    { expiresAt: { [sequelize_1.Op.gt]: new Date() } }
                ]
            }
        });
    }
    findAllActiveMutes(userId) {
        return this.models.ForumMute.findAll({
            where: {
                userId,
                [sequelize_1.Op.or]: [
                    { expiresAt: null },
                    { expiresAt: { [sequelize_1.Op.gt]: new Date() } }
                ]
            }
        });
    }
    removeMute(userId) {
        return this.models.ForumMute.destroy({
            where: { userId }
        });
    }
    async getTopicParticipants(topicId) {
        const messages = await this.models.ForumMessage.findAll({
            where: { topicId },
            attributes: ['userId'],
            include: [
                {
                    model: this.models.User,
                    as: 'user',
                    attributes: ['id', 'name', 'email', 'avatarUrl', 'isAdmin', 'isSuperAdmin', 'subscriptionTier']
                }
            ]
        });
        const uniqueUsers = new Map();
        messages.forEach(msg => {
            if (msg.user && !uniqueUsers.has(msg.userId)) {
                uniqueUsers.set(msg.userId, msg);
            }
        });
        return Array.from(uniqueUsers.values());
    }
    findUserById(userId) {
        return this.models.User.findByPk(userId, {
            attributes: ['id', 'email', 'name']
        });
    }
}
exports.ForumRepository = ForumRepository;
//# sourceMappingURL=forum-repository.js.map