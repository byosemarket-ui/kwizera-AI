/**

 * KWIZERA AI STUDIO — Video Quality Prediction Engine types (Step 7L)

 */
export var VideoQualityPredictionPlatform;
(function (VideoQualityPredictionPlatform) {
    VideoQualityPredictionPlatform["TikTok"] = "tiktok";
    VideoQualityPredictionPlatform["Instagram"] = "instagram";
    VideoQualityPredictionPlatform["Facebook"] = "facebook";
    VideoQualityPredictionPlatform["YouTube"] = "youtube";
    VideoQualityPredictionPlatform["WhatsApp"] = "whatsapp";
    VideoQualityPredictionPlatform["Website"] = "website";
    VideoQualityPredictionPlatform["Television"] = "television";
    VideoQualityPredictionPlatform["DigitalSignage"] = "digital-signage";
})(VideoQualityPredictionPlatform || (VideoQualityPredictionPlatform = {}));
export class VideoQualityPredictionEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoQualityPredictionEngineError";
    }
}
//# sourceMappingURL=types.js.map