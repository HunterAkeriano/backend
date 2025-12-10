"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileController = void 0;
const zod_1 = require("zod");
const auth_1 = require("../../../middleware/auth");
const profile_service_1 = require("../../../application/services/profile-service");
const user_repository_1 = require("../../../infrastructure/repositories/user-repository");
const upload_1 = require("../../../middleware/upload");
const apiError_1 = require("../../../utils/apiError");
const updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(120).optional(),
    avatarUrl: zod_1.z.string().url().optional()
});
class ProfileController {
    constructor(env, models) {
        this.env = env;
        this.basePath = '/profile';
        this.auth = (0, auth_1.createAuthMiddleware)(this.env);
        this.service = new profile_service_1.ProfileService(env, new user_repository_1.UserRepository(models));
    }
    register(router) {
        router.get('/', this.auth, async (req, res) => {
            try {
                const user = await this.service.getProfile(req.userId);
                res.json({ user });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to load profile');
            }
        });
        router.put('/', this.auth, async (req, res) => {
            const parsed = updateProfileSchema.safeParse(req.body);
            if (!parsed.success) {
                return (0, apiError_1.sendApiError)(res, 400, 'Invalid payload', { details: parsed.error.issues });
            }
            try {
                const user = await this.service.updateProfile(req.userId, parsed.data);
                res.json({ user });
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to update profile');
            }
        });
        router.post('/avatar', this.auth, upload_1.uploadAvatar.single('avatar'), async (req, res) => {
            if (!req.file) {
                return (0, apiError_1.sendApiError)(res, 400, 'No file uploaded');
            }
            try {
                const result = await this.service.updateAvatar(req.userId, req.file.filename, req.get('host'), req.protocol);
                res.json(result);
            }
            catch (err) {
                if (err?.status)
                    return (0, apiError_1.sendApiError)(res, err.status, err.message, { details: err.details });
                return (0, apiError_1.sendApiError)(res, 500, 'Failed to update avatar');
            }
        });
    }
}
exports.ProfileController = ProfileController;
//# sourceMappingURL=profile-controller.js.map