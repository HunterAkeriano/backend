"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChristmasGiftController = void 0;
const christmas_gift_service_1 = require("../../../application/services/christmas-gift-service");
const profile_service_1 = require("../../../application/services/profile-service");
const user_repository_1 = require("../../../infrastructure/repositories/user-repository");
const auth_1 = require("../../../middleware/auth");
const apiError_1 = require("../../../utils/apiError");
const api_error_1 = require("../../../core/errors/api-error");
class ChristmasGiftController {
    constructor(env, models) {
        this.env = env;
        this.models = models;
        this.basePath = '/christmas-gift';
        this.authMiddleware = (0, auth_1.createAuthMiddleware)(env);
        this.service = new christmas_gift_service_1.ChristmasGiftService(models);
        this.profileService = new profile_service_1.ProfileService(env, new user_repository_1.UserRepository(models));
    }
    register(router) {
        router.post('/claim', this.authMiddleware, async (req, res) => {
            try {
                const authReq = req;
                const userId = authReq.userId;
                if (!userId) {
                    return (0, apiError_1.sendApiError)(res, 401, 'Unauthorized');
                }
                console.log('[ChristmasGift] Claiming gift for user:', userId);
                const result = await this.service.claimGift(userId);
                this.profileService.clearCache(userId);
                (0, auth_1.clearAuthCache)(userId);
                console.log('[ChristmasGift] Gift claimed successfully, all caches cleared:', result);
                res.json({
                    message: 'Premium subscription granted successfully',
                    subscriptionExpiresAt: result.subscriptionExpiresAt,
                    subscriptionTier: result.subscriptionTier
                });
            }
            catch (error) {
                console.error('[ChristmasGift] Error claiming gift:', error);
                if (error instanceof api_error_1.ApiError) {
                    return (0, apiError_1.sendApiError)(res, error.status, error.message);
                }
                (0, apiError_1.sendApiError)(res, 500, 'Failed to claim gift');
            }
        });
    }
}
exports.ChristmasGiftController = ChristmasGiftController;
//# sourceMappingURL=christmas-gift-controller.js.map