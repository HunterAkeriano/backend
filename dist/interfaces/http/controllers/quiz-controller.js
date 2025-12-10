"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuizController = void 0;
const zod_1 = require("zod");
const auth_1 = require("../../../middleware/auth");
const quiz_service_1 = require("../../../application/services/quiz-service");
const apiError_1 = require("../../../utils/apiError");
const quizCategoryEnum = zod_1.z.enum(['css', 'scss', 'stylus']);
const quizDifficultyEnum = zod_1.z.enum(['easy', 'medium', 'hard']);
const quizResultCategoryEnum = zod_1.z.enum(['css', 'scss', 'stylus', 'mix']);
const createQuestionSchema = zod_1.z.object({
    questionText: zod_1.z.string().min(10).max(1000),
    questionTextUk: zod_1.z.string().min(10).max(1000).optional().nullable(),
    codeSnippet: zod_1.z.string().max(5000).optional().nullable(),
    answers: zod_1.z.array(zod_1.z.string().min(1).max(500)).min(2).max(6),
    answersUk: zod_1.z.array(zod_1.z.string().min(1).max(500)).min(2).max(6).optional().nullable(),
    correctAnswerIndex: zod_1.z.number().int().min(0),
    explanation: zod_1.z.string().max(2000).optional().nullable(),
    explanationUk: zod_1.z.string().max(2000).optional().nullable(),
    category: quizCategoryEnum,
    difficulty: quizDifficultyEnum
});
const updateQuestionSchema = createQuestionSchema.partial();
const updateSettingsSchema = zod_1.z.object({
    questionsPerTest: zod_1.z.number().int().min(5).max(100),
    timePerQuestion: zod_1.z.number().int().min(10).max(300)
});
const submitTestSchema = zod_1.z.object({
    category: quizResultCategoryEnum,
    answers: zod_1.z
        .array(zod_1.z.object({
        questionId: zod_1.z.string().min(1).refine((id) => {
            // Accept UUIDs or simple alphanumeric strings
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const simpleIdRegex = /^[a-z0-9]+$/i;
            return uuidRegex.test(id) || simpleIdRegex.test(id);
        }, { message: 'Invalid question ID format' }),
        answerIndex: zod_1.z.number().int().min(0)
    }))
        .min(1),
    timeTaken: zod_1.z.number().int().min(0),
    username: zod_1.z.string().min(1).max(50).optional().nullable()
});
class QuizController {
    constructor(env, models) {
        this.env = env;
        this.basePath = '/quiz';
        this.auth = (0, auth_1.createAuthMiddleware)(this.env);
        this.optionalAuth = (0, auth_1.createOptionalAuthMiddleware)(this.env);
        this.service = new quiz_service_1.QuizService(env, models);
    }
    register(router) {
        router.get('/questions', this.auth, auth_1.requireAdmin, async (req, res) => {
            try {
                const lang = this.getPreferredLanguage(req);
                const questions = await this.service.listQuestions(lang);
                res.json({ questions });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to fetch questions');
            }
        });
        router.post('/questions', this.auth, auth_1.requireAdmin, async (req, res) => {
            const parsed = createQuestionSchema.safeParse(req.body);
            if (!parsed.success) {
                return (0, apiError_1.sendApiError)(res, 400, 'Invalid input', { details: parsed.error.issues });
            }
            try {
                if (parsed.data.correctAnswerIndex >= parsed.data.answers.length) {
                    return (0, apiError_1.sendApiError)(res, 400, 'correctAnswerIndex out of range');
                }
                const lang = this.getPreferredLanguage(req);
                const question = await this.service.createQuestion(parsed.data, lang);
                res.status(201).json({ question });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to create question');
            }
        });
        router.put('/questions/:id', this.auth, auth_1.requireAdmin, async (req, res) => {
            const parsed = updateQuestionSchema.safeParse(req.body);
            if (!parsed.success) {
                return (0, apiError_1.sendApiError)(res, 400, 'Invalid input', { details: parsed.error.issues });
            }
            try {
                const lang = this.getPreferredLanguage(req);
                const question = await this.service.updateQuestion(req.params.id, parsed.data, lang);
                res.json({ question });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to update question');
            }
        });
        router.delete('/questions/:id', this.auth, auth_1.requireAdmin, async (req, res) => {
            try {
                await this.service.deleteQuestion(req.params.id);
                res.json({ message: 'Question deleted successfully' });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to delete question');
            }
        });
        router.get('/settings', this.auth, auth_1.requireAdmin, async (_req, res) => {
            try {
                const settings = await this.service.getSettings();
                res.json({ settings });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to fetch settings');
            }
        });
        router.put('/settings', this.auth, auth_1.requireAdmin, async (req, res) => {
            const parsed = updateSettingsSchema.safeParse(req.body);
            if (!parsed.success) {
                return (0, apiError_1.sendApiError)(res, 400, 'Invalid input', { details: parsed.error.issues });
            }
            try {
                const settings = await this.service.updateSettings(parsed.data);
                res.json({ settings });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to update settings');
            }
        });
        router.get('/check-limit', this.optionalAuth, async (req, res) => {
            try {
                const authReq = req;
                const limitInfo = await this.service.checkLimit(authReq.userId || null, this.getClientIp(req));
                res.json(limitInfo);
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to check attempt limit');
            }
        });
        router.get('/test', this.optionalAuth, async (req, res) => {
            try {
                const authReq = req;
                const category = req.query.category || 'mix';
                const lang = this.getPreferredLanguage(req);
                const test = await this.service.generateTest(category, lang, authReq.userId || null, this.getClientIp(req));
                res.json(test);
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to generate test');
            }
        });
        router.post('/submit', this.optionalAuth, async (req, res) => {
            const parsed = submitTestSchema.safeParse(req.body);
            if (!parsed.success) {
                return (0, apiError_1.sendApiError)(res, 400, 'Invalid input', { details: parsed.error.issues });
            }
            try {
                const authReq = req;
                const lang = this.getPreferredLanguage(req);
                const ipAddress = this.getClientIp(req);
                const result = await this.service.submitTest({
                    ...parsed.data,
                    userId: authReq.userId || null,
                    lang,
                    ipAddress
                });
                res.json(result);
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to submit test');
            }
        });
        router.get('/my-results', this.auth, async (req, res) => {
            try {
                const results = await this.service.myResults(req.userId);
                res.json({ results });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to fetch results');
            }
        });
        router.get('/leaderboard', async (req, res) => {
            try {
                const category = req.query.category || 'all';
                const limitParam = parseInt(req.query.limit || '10');
                const limit = isNaN(limitParam) ? 10 : limitParam;
                const leaderboard = await this.service.leaderboard(category, limit);
                res.json({ leaderboard });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to fetch leaderboard');
            }
        });
    }
    getPreferredLanguage(req) {
        const header = (req.headers['accept-language'] || '').toString().toLowerCase();
        if (header.startsWith('uk'))
            return 'uk';
        return 'en';
    }
    getClientIp(req) {
        return ((req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim() ||
            (req.headers['x-real-ip'] ?? '') ||
            req.socket.remoteAddress ||
            'unknown');
    }
}
exports.QuizController = QuizController;
//# sourceMappingURL=quiz-controller.js.map