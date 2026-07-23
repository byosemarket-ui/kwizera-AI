/**
 * KWIZERA AI STUDIO — Image Quality Prediction Engine types (Step 6L)
 */
export var ImageQualityPredictionPlatform;
(function (ImageQualityPredictionPlatform) {
    ImageQualityPredictionPlatform["Instagram"] = "instagram";
    ImageQualityPredictionPlatform["Facebook"] = "facebook";
    ImageQualityPredictionPlatform["TikTok"] = "tiktok";
    ImageQualityPredictionPlatform["YouTube"] = "youtube";
    ImageQualityPredictionPlatform["WhatsApp"] = "whatsapp";
    ImageQualityPredictionPlatform["Website"] = "website";
    ImageQualityPredictionPlatform["Print"] = "print";
})(ImageQualityPredictionPlatform || (ImageQualityPredictionPlatform = {}));
export class ImageQualityPredictionEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageQualityPredictionEngineError";
    }
}
//# sourceMappingURL=types.js.map