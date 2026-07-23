/**
 * KWIZERA AI STUDIO — Video Enhancement Planning Engine types (Step 7I)
 */
export var VideoEnhancementPlatform;
(function (VideoEnhancementPlatform) {
    VideoEnhancementPlatform["TikTok"] = "tiktok";
    VideoEnhancementPlatform["Instagram"] = "instagram";
    VideoEnhancementPlatform["Facebook"] = "facebook";
    VideoEnhancementPlatform["YouTube"] = "youtube";
    VideoEnhancementPlatform["WhatsApp"] = "whatsapp";
    VideoEnhancementPlatform["Website"] = "website";
    VideoEnhancementPlatform["Television"] = "television";
    VideoEnhancementPlatform["PrintPreview"] = "print-preview";
})(VideoEnhancementPlatform || (VideoEnhancementPlatform = {}));
export var EnhancementType;
(function (EnhancementType) {
    EnhancementType["Visual"] = "visual";
    EnhancementType["Audio"] = "audio";
    EnhancementType["Motion"] = "motion";
    EnhancementType["Restoration"] = "restoration";
    EnhancementType["Cinematic"] = "cinematic";
    EnhancementType["Platform"] = "platform";
    EnhancementType["Stabilization"] = "stabilization";
    EnhancementType["Color"] = "color";
})(EnhancementType || (EnhancementType = {}));
export class VideoEnhancementPlanningEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoEnhancementPlanningEngineError";
    }
}
//# sourceMappingURL=types.js.map