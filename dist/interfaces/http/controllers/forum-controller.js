"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForumController = void 0;
const zod_1 = require("zod");
const auth_1 = require("../../../middleware/auth");
const forum_repository_1 = require("../../../infrastructure/repositories/forum-repository");
const forum_service_1 = require("../../../application/services/forum-service");
const apiError_1 = require("../../../utils/apiError");
const upload_1 = require("../../../middleware/upload");
const forum_ws_1 = require("../../ws/forum-ws");
const mailer_service_1 = require("../../../application/services/mailer-service");
const topicSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(300),
    description: zod_1.z.string().min(10).max(20000),
    attachments: zod_1.z
        .array(zod_1.z.object({ type: zod_1.z.enum(["image", "youtube"]), url: zod_1.z.string().url() }))
        .max(10)
        .optional(),
});
const nullableParentId = zod_1.z.preprocess((value) => (value === null || value === "" ? undefined : value), zod_1.z.string().uuid().optional());
const messageSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(10000),
    parentId: nullableParentId,
    attachments: zod_1.z
        .array(zod_1.z.object({ type: zod_1.z.enum(["image", "youtube"]), url: zod_1.z.string().url() }))
        .max(5)
        .optional(),
});
const statusSchema = zod_1.z.object({
    status: zod_1.z.enum(["open", "in_review", "closed"]),
});
class ForumController {
    constructor(env, models) {
        this.env = env;
        this.basePath = "/forum";
        this.auth = (0, auth_1.createAuthMiddleware)(this.env);
        this.service = new forum_service_1.ForumService(new forum_repository_1.ForumRepository(models), env.API_URL, env, new mailer_service_1.MailerService(env));
    }
    register(router) {
        router.get("/topics/pinned", async (req, res) => {
            const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || "5") || 5));
            try {
                const topics = await this.service.listPinnedTopics(limit);
                res.json({ topics });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to load pinned topics");
            }
        });
        router.get("/topics", async (req, res) => {
            const page = Math.max(1, parseInt(req.query.page || "1") || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20") || 20));
            const status = req.query.status || undefined;
            const allowedStatuses = ["open", "in_review", "closed"];
            const normalizedStatus = allowedStatuses.includes(String(status))
                ? status
                : undefined;
            try {
                const payload = await this.service.listTopics({
                    page,
                    limit,
                    status: normalizedStatus,
                });
                res.json(payload);
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to load topics");
            }
        });
        router.post("/topics", this.auth, async (req, res) => {
            const parsed = topicSchema.safeParse(req.body);
            if (!parsed.success) {
                return (0, apiError_1.sendApiError)(res, 400, "Invalid input", {
                    details: parsed.error.issues,
                });
            }
            try {
                const topic = await this.service.createTopic(req.userId, {
                    ...parsed.data,
                    attachments: this.sanitizeAttachments(parsed.data.attachments ?? []),
                });
                res.status(201).json({ topic });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to create topic");
            }
        });
        router.get("/topics/:id", async (req, res) => {
            try {
                const payload = await this.service.getTopic(req.params.id);
                res.json(payload);
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to load topic");
            }
        });
        router.patch("/topics/:id", this.auth, async (req, res) => {
            const parsed = topicSchema.partial().safeParse(req.body);
            if (!parsed.success) {
                return (0, apiError_1.sendApiError)(res, 400, "Invalid input", {
                    details: parsed.error.issues,
                });
            }
            try {
                const patch = {
                    ...parsed.data,
                    attachments: parsed.data.attachments
                        ? this.sanitizeAttachments(parsed.data.attachments)
                        : undefined,
                };
                const topic = await this.service.updateTopicContent(req.params.id, req.userId, patch, Boolean(req.authUser?.isAdmin));
                (0, forum_ws_1.broadcastForumEvent)(req.params.id, "topic-updated", topic);
                res.json({ topic });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to update topic");
            }
        });
        router.patch("/topics/:id/status", this.auth, auth_1.requireAdmin, async (req, res) => {
            const parsed = statusSchema.safeParse(req.body);
            if (!parsed.success) {
                return (0, apiError_1.sendApiError)(res, 400, "Invalid status", {
                    details: parsed.error.issues,
                });
            }
            try {
                const topic = await this.service.updateStatus(req.params.id, parsed.data.status, Boolean(req.authUser?.isAdmin));
                (0, forum_ws_1.broadcastForumEvent)(req.params.id, "status", topic);
                res.json({ topic });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to update status");
            }
        });
        router.post("/topics/:id/pin", this.auth, auth_1.requireAdmin, async (req, res) => {
            try {
                if (!req.userId)
                    return (0, apiError_1.sendApiError)(res, 401, "Unauthorized");
                const topic = await this.service.pinTopic(req.params.id, req.userId);
                (0, forum_ws_1.broadcastForumEvent)(req.params.id, "topic-updated", topic);
                res.json({ topic });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to pin topic");
            }
        });
        router.delete("/topics/:id/pin", this.auth, auth_1.requireAdmin, async (req, res) => {
            try {
                if (!req.userId)
                    return (0, apiError_1.sendApiError)(res, 401, "Unauthorized");
                const topic = await this.service.unpinTopic(req.params.id);
                (0, forum_ws_1.broadcastForumEvent)(req.params.id, "topic-updated", topic);
                res.json({ topic });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to unpin topic");
            }
        });
        router.post("/topics/:id/messages", this.auth, async (req, res) => {
            const parsed = messageSchema.safeParse(req.body);
            if (!parsed.success) {
                return (0, apiError_1.sendApiError)(res, 400, "Invalid input", {
                    details: parsed.error.issues,
                });
            }
            if (!req.userId)
                return (0, apiError_1.sendApiError)(res, 401, "Unauthorized");
            const attachments = this.filterAttachments(parsed.data.attachments ?? []);
            try {
                const payload = await this.service.addMessage({
                    topicId: req.params.id,
                    userId: req.userId,
                    content: parsed.data.content,
                    parentId: parsed.data.parentId ?? null,
                    attachments,
                    isAdmin: Boolean(req.authUser?.isAdmin),
                });
                (0, forum_ws_1.broadcastForumEvent)(req.params.id, "message", payload.message);
                if (payload.topic.owner?.id &&
                    payload.topic.owner.id !== req.userId) {
                    const topicStatus = payload.topic.status;
                    if (topicStatus === "open" || topicStatus === "in_review") {
                        (0, forum_ws_1.sendUserNotification)(payload.topic.owner.id, {
                            topicId: payload.topic.id,
                            topicTitle: payload.topic.title,
                            message: payload.message.content,
                            author: { name: payload.message.author?.name || null },
                        });
                    }
                }
                res.status(201).json(payload);
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to add message");
            }
        });
        router.patch("/topics/:id/messages/:messageId", this.auth, async (req, res) => {
            const parsed = messageSchema
                .pick({ content: true })
                .safeParse(req.body);
            if (!parsed.success) {
                return (0, apiError_1.sendApiError)(res, 400, "Invalid input", {
                    details: parsed.error.issues,
                });
            }
            try {
                const message = await this.service.editMessage({
                    topicId: req.params.id,
                    messageId: req.params.messageId,
                    userId: req.userId,
                    content: parsed.data.content,
                    isAdmin: Boolean(req.authUser?.isAdmin),
                });
                (0, forum_ws_1.broadcastForumEvent)(req.params.id, "message-edit", message);
                res.json({ message });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to update message");
            }
        });
        router.post("/attachments", this.auth, upload_1.uploadForumAttachment.single("file"), async (req, res) => {
            if (!req.file) {
                return (0, apiError_1.sendApiError)(res, 400, "No file uploaded");
            }
            const topicId = req.query.topicId || "temp";
            const url = `${this.env.API_URL}/uploads/forum/${topicId}/${req.file.filename}`;
            res.status(201).json({ url });
        });
        router.get("/my-topics/open", this.auth, async (req, res) => {
            try {
                const topics = await this.service.getUserOpenTopics(req.userId);
                res.json({ topics });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to load user topics");
            }
        });
        router.get("/topics/:id/participants", async (req, res) => {
            try {
                const participants = await this.service.getTopicParticipants(req.params.id);
                res.json({ participants });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to load participants");
            }
        });
        router.post("/mute/:userId", this.auth, auth_1.requireModerator, async (req, res) => {
            const muteSchema = zod_1.z.object({
                durationMinutes: zod_1.z.number().nullable(),
                reason: zod_1.z.string().optional(),
            });
            const parsed = muteSchema.safeParse(req.body);
            if (!parsed.success) {
                return (0, apiError_1.sendApiError)(res, 400, "Invalid input", {
                    details: parsed.error.issues,
                });
            }
            const expiresAt = parsed.data.durationMinutes
                ? new Date(Date.now() + parsed.data.durationMinutes * 60 * 1000)
                : null;
            try {
                await this.service.muteUser({
                    userId: req.params.userId,
                    mutedBy: req.userId,
                    expiresAt,
                    reason: parsed.data.reason,
                    isModerator: Boolean(req.authUser?.isAdmin || req.authUser?.isSuperAdmin),
                });
                res.json({ success: true });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to mute user");
            }
        });
        router.get("/mute/:userId", this.auth, auth_1.requireModerator, async (req, res) => {
            try {
                const mute = await this.service.getActiveMute(req.params.userId);
                res.json(mute);
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to load mute status");
            }
        });
        router.delete("/mute/:userId", this.auth, auth_1.requireModerator, async (req, res) => {
            try {
                await this.service.unmuteUser({
                    userId: req.params.userId,
                    actorId: req.userId,
                    isModerator: Boolean(req.authUser?.isAdmin || req.authUser?.isSuperAdmin),
                });
                res.json({ success: true });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to unmute user");
            }
        });
        router.delete("/topics/:id/messages/:userId", this.auth, auth_1.requireModerator, async (req, res) => {
            try {
                const result = await this.service.removeUserMessages({
                    topicId: req.params.id,
                    userId: req.params.userId,
                    actorId: req.userId,
                    isModerator: Boolean(req.authUser?.isAdmin || req.authUser?.isSuperAdmin),
                });
                res.json(result);
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to delete messages");
            }
        });
        router.get("/my-mutes", this.auth, async (req, res) => {
            try {
                const mutes = await this.service.getUserActiveMutes(req.userId);
                res.json({ mutes });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to load mutes");
            }
        });
        router.get("/mute-status", this.auth, async (req, res) => {
            try {
                const status = await this.service.checkUserMute(req.userId);
                res.json(status);
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, {
                        details: err.details,
                    });
                return (0, apiError_1.sendApiError)(res, 500, "Failed to check mute status");
            }
        });
    }
    filterAttachments(attachments) {
        return this.sanitizeAttachments(attachments);
    }
    sanitizeAttachments(attachments) {
        const result = [];
        for (const item of attachments) {
            if (item.type === "youtube") {
                const id = this.extractYoutubeId(item.url);
                if (id) {
                    result.push({
                        type: "youtube",
                        url: `https://www.youtube.com/embed/${id}`,
                    });
                }
            }
            else {
                result.push(item);
            }
        }
        return result;
    }
    extractYoutubeId(url) {
        const match = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/i);
        return match ? match[1] : null;
    }
}
exports.ForumController = ForumController;
//# sourceMappingURL=forum-controller.js.map