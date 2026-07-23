/**
 * KWIZERA AI STUDIO — Image Enhancement Planning Engine types (Step 6I)
 */
export var EnhancementPlatform;
(function (EnhancementPlatform) {
    EnhancementPlatform["TikTok"] = "tiktok";
    EnhancementPlatform["Instagram"] = "instagram";
    EnhancementPlatform["Facebook"] = "facebook";
    EnhancementPlatform["YouTube"] = "youtube";
    EnhancementPlatform["WhatsApp"] = "whatsapp";
    EnhancementPlatform["Website"] = "website";
})(EnhancementPlatform || (EnhancementPlatform = {}));
export var EnhancementPlanType;
(function (EnhancementPlanType) {
    EnhancementPlanType["Restoration"] = "restoration";
    EnhancementPlanType["Optimization"] = "optimization";
    EnhancementPlanType["Cleanup"] = "cleanup";
    EnhancementPlanType["Background"] = "background";
    EnhancementPlanType["Lighting"] = "lighting";
    EnhancementPlanType["Color"] = "color";
    EnhancementPlanType["Sharpness"] = "sharpness";
    EnhancementPlanType["Quality"] = "quality";
})(EnhancementPlanType || (EnhancementPlanType = {}));
export class ImageEnhancementPlanningEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageEnhancementPlanningEngineError";
    }
}
//# sourceMappingURL=types.js.map