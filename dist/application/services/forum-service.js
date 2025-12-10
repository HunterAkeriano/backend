"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForumService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fs_2 = require("fs");
const apiError_1 = require("../../utils/apiError");
const mailer_service_1 = require("./mailer-service");
const mail_builder_1 = require("../../interfaces/http/mail-builder");
class ForumService {
    constructor(repo, apiUrl = "http://localhost:4000", env, mailer, mailBuilder = new mail_builder_1.MailBuilder()) {
        this.repo = repo;
        this.apiUrl = apiUrl;
        this.env = env;
        this.mailer = env ? mailer ?? new mailer_service_1.MailerService(env) : undefined;
        this.mailBuilder = mailBuilder;
    }
    toFullUrl(url) {
        if (url.startsWith("/")) {
            return `${this.apiUrl}${url}`;
        }
        return url;
    }
    serializeAttachments(attachments) {
        if (!attachments)
            return [];
        return attachments.map((att) => ({
            ...att,
            url: this.toFullUrl(att.url),
        }));
    }
    uploadsRoot() {
        return path_1.default.resolve(process.cwd(), "uploads/forum");
    }
    parsePathFromUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.pathname;
        }
        catch {
            return url.startsWith("/") ? url : null;
        }
    }
    async ensureDir(dir) {
        if (!fs_1.default.existsSync(dir)) {
            await fs_2.promises.mkdir(dir, { recursive: true });
        }
    }
    async moveAttachmentsToTopic(topicId, attachments) {
        const targetDir = path_1.default.join(this.uploadsRoot(), topicId);
        await this.ensureDir(targetDir);
        const normalized = [];
        for (const att of attachments) {
            const pathname = this.parsePathFromUrl(att.url);
            if (!pathname)
                continue;
            const currentPath = pathname.startsWith("/uploads/forum")
                ? path_1.default.join(this.uploadsRoot(), pathname.replace("/uploads/forum/", ""))
                : null;
            if (currentPath &&
                currentPath.includes(path_1.default.join(this.uploadsRoot(), "temp"))) {
                const filename = path_1.default.basename(currentPath);
                const destination = path_1.default.join(targetDir, filename);
                try {
                    await fs_2.promises.rename(currentPath, destination);
                }
                catch {
                    await fs_2.promises.copyFile(currentPath, destination);
                    await fs_2.promises.unlink(currentPath);
                }
                normalized.push({
                    ...att,
                    url: `/uploads/forum/${topicId}/${filename}`,
                });
            }
            else {
                normalized.push(att);
            }
        }
        return normalized;
    }
    async deleteRemovedAttachments(topicId, previous, next) {
        const nextUrls = new Set(next.map((a) => a.url));
        const toDelete = previous.filter((att) => !nextUrls.has(att.url));
        for (const att of toDelete) {
            const pathname = this.parsePathFromUrl(att.url);
            if (!pathname)
                continue;
            const filePath = path_1.default.join(this.uploadsRoot(), pathname.replace("/uploads/forum/", ""));
            if (filePath.includes(path_1.default.join(this.uploadsRoot(), topicId)) &&
                fs_1.default.existsSync(filePath)) {
                try {
                    await fs_2.promises.unlink(filePath);
                }
                catch {
                    // ignore
                }
            }
        }
    }
    serializeTopic(topic) {
        const { user, attachments, pin, ...rest } = topic.get({ plain: true });
        const owner = user;
        const pinData = pin;
        return {
            ...rest,
            attachments: this.serializeAttachments(attachments),
            isPinned: Boolean(pinData),
            pinnedAt: pinData?.createdAt ?? null,
            pinnedBy: pinData?.createdBy ?? null,
            owner: owner
                ? {
                    id: owner.id,
                    name: owner.name,
                    email: owner.email,
                    avatarUrl: owner.avatarUrl,
                    isAdmin: Boolean(owner.isAdmin),
                    subscriptionTier: owner.subscriptionTier ?? "free",
                }
                : null,
        };
    }
    serializeMessage(message) {
        const { user, attachments, ...rest } = message.get({ plain: true });
        const author = user;
        return {
            ...rest,
            attachments: this.serializeAttachments(attachments),
            author: author
                ? {
                    id: author.id,
                    name: author.name,
                    email: author.email,
                    avatarUrl: author.avatarUrl,
                    isAdmin: Boolean(author.isAdmin),
                    subscriptionTier: author.subscriptionTier ?? "free",
                }
                : null,
        };
    }
    async listTopics(options) {
        const limit = Math.min(100, Math.max(1, options.limit));
        const page = Math.max(1, options.page);
        const result = await this.repo.listTopics({ ...options, page, limit });
        const topics = result.rows.map((topic) => this.serializeTopic(topic));
        const total = Array.isArray(result.count)
            ? result.count.length
            : result.count;
        return {
            topics,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
        };
    }
    async createTopic(userId, payload) {
        const mute = await this.repo.findActiveMute(userId);
        if (mute) {
            const muteMessage = mute.expiresAt
                ? `You are muted until ${new Date(mute.expiresAt).toLocaleString()}`
                : "You are permanently muted";
            throw (0, apiError_1.toApiError)(403, muteMessage);
        }
        const created = await this.repo.createTopic({
            userId,
            title: payload.title,
            description: payload.description,
            status: "open",
            attachments: [],
            messagesCount: 0,
            lastActivityAt: new Date(),
        });
        const normalizedAttachments = await this.moveAttachmentsToTopic(created.id, payload.attachments ?? []);
        if (normalizedAttachments.length !== payload.attachments.length ||
            normalizedAttachments.length > 0) {
            await this.repo.updateTopic(created, {
                attachments: normalizedAttachments,
            });
            created.attachments = normalizedAttachments;
        }
        return this.serializeTopic(created);
    }
    async getTopic(topicId) {
        const topic = await this.repo.findTopicById(topicId);
        if (!topic)
            throw (0, apiError_1.toApiError)(404, "Topic not found");
        const messages = await this.repo.listMessages(topicId);
        return {
            topic: this.serializeTopic(topic),
            messages: messages.map((m) => this.serializeMessage(m)),
        };
    }
    assertCanPost(status, isAdmin) {
        if (status === "open")
            return;
        if (status === "in_review" && isAdmin)
            return;
        if (status === "closed" && isAdmin)
            return;
        throw (0, apiError_1.toApiError)(403, "Topic is not accepting replies");
    }
    async addMessage(payload) {
        const topic = await this.repo.findTopicById(payload.topicId);
        if (!topic)
            throw (0, apiError_1.toApiError)(404, "Topic not found");
        this.assertCanPost(topic.status, payload.isAdmin);
        if (!payload.isAdmin) {
            const mute = await this.repo.findActiveMute(payload.userId);
            if (mute) {
                const muteMessage = mute.expiresAt
                    ? `You are muted until ${new Date(mute.expiresAt).toLocaleString()}`
                    : "You are permanently muted";
                throw (0, apiError_1.toApiError)(403, muteMessage);
            }
        }
        const created = await this.repo.createMessage({
            topicId: payload.topicId,
            userId: payload.userId,
            parentId: payload.parentId || null,
            content: payload.content,
            attachments: payload.attachments,
            editedAt: null,
            editedBy: null,
        });
        const message = (await this.repo.findMessageById(created.id)) ?? created;
        await this.repo.updateTopic(topic, {
            messagesCount: (topic.messagesCount || 0) + 1,
            lastActivityAt: new Date(),
        });
        return {
            topic: this.serializeTopic(topic),
            message: this.serializeMessage(message),
        };
    }
    async editMessage(payload) {
        const topic = await this.repo.findTopicById(payload.topicId);
        if (!topic)
            throw (0, apiError_1.toApiError)(404, "Topic not found");
        const message = await this.repo.findMessageById(payload.messageId);
        if (!message || message.topicId !== payload.topicId) {
            throw (0, apiError_1.toApiError)(404, "Message not found");
        }
        const isOwner = message.userId === payload.userId;
        const canEdit = payload.isAdmin || (isOwner && topic.status === "open");
        if (!canEdit)
            throw (0, apiError_1.toApiError)(403, "Editing is not allowed for this topic");
        await message.update({
            content: payload.content,
            editedAt: new Date(),
            editedBy: payload.userId,
        });
        await this.repo.updateTopic(topic, { lastActivityAt: new Date() });
        return this.serializeMessage(message);
    }
    async updateStatus(topicId, status, actorIsAdmin) {
        if (!actorIsAdmin)
            throw (0, apiError_1.toApiError)(403, "Admin access required");
        const topic = await this.repo.findTopicById(topicId);
        if (!topic)
            throw (0, apiError_1.toApiError)(404, "Topic not found");
        await this.repo.updateTopic(topic, { status, lastActivityAt: new Date() });
        const updated = await this.repo.findTopicById(topicId);
        const serialized = this.serializeTopic(updated || topic);
        await this.notifyTopicStatusChange(serialized, status);
        return serialized;
    }
    async updateTopicContent(topicId, userId, patch, isAdmin) {
        const topic = await this.repo.findTopicById(topicId);
        if (!topic)
            throw (0, apiError_1.toApiError)(404, "Topic not found");
        if (topic.status !== "open" && !isAdmin) {
            throw (0, apiError_1.toApiError)(403, "Editing is locked for this topic");
        }
        if (topic.userId !== userId && !isAdmin) {
            throw (0, apiError_1.toApiError)(403, "You cannot edit this topic");
        }
        const nextAttachments = patch.attachments
            ? await this.moveAttachmentsToTopic(topicId, patch.attachments)
            : topic.attachments;
        await this.deleteRemovedAttachments(topicId, topic.attachments || [], nextAttachments || []);
        await this.repo.updateTopic(topic, {
            ...patch,
            attachments: nextAttachments,
            updatedAt: new Date(),
        });
        return this.serializeTopic(topic);
    }
    async getUserOpenTopics(userId) {
        const topics = await this.repo.findUserOpenTopics(userId);
        return topics.map((topic) => ({
            id: topic.id,
            status: topic.status,
        }));
    }
    async listPinnedTopics(limit) {
        const normalizedLimit = Math.min(20, Math.max(1, limit));
        const pins = await this.repo.listPinnedTopics(normalizedLimit);
        return pins
            .map((pin) => {
            const topic = pin.topic;
            if (topic) {
                topic.pin = {
                    createdAt: pin.createdAt,
                    createdBy: pin.createdBy,
                };
            }
            return topic;
        })
            .filter((topic) => Boolean(topic))
            .map((topic) => this.serializeTopic(topic));
    }
    async pinTopic(topicId, actorId) {
        const topic = await this.repo.findTopicById(topicId);
        if (!topic)
            throw (0, apiError_1.toApiError)(404, "Topic not found");
        await this.repo.pinTopic(topicId, actorId);
        const updated = await this.repo.findTopicById(topicId);
        return this.serializeTopic(updated || topic);
    }
    async unpinTopic(topicId) {
        const topic = await this.repo.findTopicById(topicId);
        if (!topic)
            throw (0, apiError_1.toApiError)(404, "Topic not found");
        await this.repo.unpinTopic(topicId);
        const updated = await this.repo.findTopicById(topicId);
        return this.serializeTopic(updated || topic);
    }
    async muteUser(payload) {
        if (!payload.isModerator) {
            throw (0, apiError_1.toApiError)(403, "Moderator or admin access required");
        }
        const existingMute = await this.repo.findActiveMute(payload.userId);
        if (existingMute) {
            await this.repo.removeMute(payload.userId);
        }
        await this.repo.createMute({
            userId: payload.userId,
            mutedBy: payload.mutedBy,
            expiresAt: payload.expiresAt,
            reason: payload.reason || null,
        });
        await this.notifyMutedUser(payload.userId, payload.expiresAt, payload.reason);
        return { success: true };
    }
    async unmuteUser(payload) {
        if (!payload.isModerator) {
            throw (0, apiError_1.toApiError)(403, "Moderator or admin access required");
        }
        await this.repo.removeMute(payload.userId);
        return { success: true };
    }
    async getActiveMute(userId) {
        const mute = await this.repo.findActiveMute(userId);
        if (!mute)
            return { muted: false };
        return {
            muted: true,
            expiresAt: mute.expiresAt,
            reason: mute.reason,
            createdAt: mute.createdAt,
        };
    }
    async removeUserMessages(payload) {
        if (!payload.isModerator) {
            throw (0, apiError_1.toApiError)(403, "Moderator or admin access required");
        }
        const topic = await this.repo.findTopicById(payload.topicId);
        if (!topic)
            throw (0, apiError_1.toApiError)(404, "Topic not found");
        const deletedCount = await this.repo.deleteMessagesByUser(payload.topicId, payload.userId);
        const newCount = Math.max(0, (topic.messagesCount || 0) - deletedCount);
        await this.repo.updateTopic(topic, {
            messagesCount: newCount,
            lastActivityAt: new Date(),
        });
        return { success: true, deletedCount };
    }
    async getTopicParticipants(topicId) {
        const topic = await this.repo.findTopicById(topicId);
        if (!topic)
            throw (0, apiError_1.toApiError)(404, "Topic not found");
        const messageResults = await this.repo.getTopicParticipants(topicId);
        const participants = new Map();
        if (topic.user) {
            const owner = topic.user;
            participants.set(owner.id, {
                id: owner.id,
                name: owner.name,
                email: owner.email,
                avatarUrl: owner.avatarUrl,
                isAdmin: Boolean(owner.isAdmin),
                subscriptionTier: owner.subscriptionTier ?? "free",
                muted: false,
            });
        }
        messageResults.forEach((msg) => {
            if (msg.user && !participants.has(msg.user.id)) {
                participants.set(msg.user.id, {
                    id: msg.user.id,
                    name: msg.user.name,
                    email: msg.user.email,
                    avatarUrl: msg.user.avatarUrl,
                    isAdmin: Boolean(msg.user.isAdmin),
                    subscriptionTier: msg.user.subscriptionTier ?? "free",
                    muted: false,
                });
            }
        });
        const list = Array.from(participants.values());
        const withMute = await Promise.all(list.map(async (user) => {
            const mute = await this.repo.findActiveMute(user.id);
            return { ...user, muted: Boolean(mute) };
        }));
        return withMute;
    }
    async getUserActiveMutes(userId) {
        const mutes = await this.repo.findAllActiveMutes(userId);
        return mutes.map((mute) => ({
            id: mute.id,
            expiresAt: mute.expiresAt,
            reason: mute.reason,
            createdAt: mute.createdAt,
        }));
    }
    async checkUserMute(userId) {
        const mute = await this.repo.findActiveMute(userId);
        return mute ? { muted: true, expiresAt: mute.expiresAt } : { muted: false };
    }
    async notifyMutedUser(userId, expiresAt, reason) {
        if (!this.mailer || !this.env)
            return;
        const user = await this.repo.findUserById(userId);
        if (!user?.email)
            return;
        const appUrl = (this.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
        const contacts = {
            forum: `${appUrl}/forum`,
            telegram: "https://t.me/dima_gulak",
            viber: "viber://chat?number=%2B380974779784",
            email: "gamerstaject@gmail.com",
        };
        try {
            await this.mailer.send({
                to: user.email,
                subject: "You were muted on the Style Engine forum",
                text: this.mailBuilder.plainMute({
                    appUrl,
                    userName: user.name,
                    reason,
                    expiresAt,
                    contacts,
                }),
                html: this.mailBuilder.htmlMute({
                    appUrl,
                    userName: user.name,
                    reason,
                    expiresAt,
                    contacts,
                }),
            });
        }
        catch (err) {
            console.error("Failed to send mute notification email", err);
        }
    }
    async notifyTopicStatusChange(topic, status) {
        if (!this.mailer || !this.env)
            return;
        const owner = topic.owner;
        if (!owner?.email)
            return;
        const appUrl = (this.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
        const contacts = {
            forum: `${appUrl}/forum`,
            telegram: "https://t.me/dima_gulak",
            viber: "viber://chat?number=%2B380974779784",
            email: "gamerstaject@gmail.com",
        };
        const topicLink = `${appUrl}/forum/${topic.id}`;
        try {
            await this.mailer.send({
                to: owner.email,
                subject: "Your forum topic status was updated",
                text: this.mailBuilder.plainTopicStatus({
                    appUrl,
                    topicTitle: topic.title,
                    status,
                    topicLink,
                    userName: owner.name,
                    contacts,
                }),
                html: this.mailBuilder.htmlTopicStatus({
                    appUrl,
                    topicTitle: topic.title,
                    status,
                    topicLink,
                    userName: owner.name,
                    contacts,
                }),
            });
        }
        catch (err) {
            console.error("Failed to send topic status email", err);
        }
    }
}
exports.ForumService = ForumService;
//# sourceMappingURL=forum-service.js.map