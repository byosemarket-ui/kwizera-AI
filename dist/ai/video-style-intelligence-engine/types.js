/**
 * KWIZERA AI STUDIO — Video Style Intelligence Engine types (Step 7H)
 */
export var StyleCategory;
(function (StyleCategory) {
    StyleCategory["Commercial"] = "commercial";
    StyleCategory["Corporate"] = "corporate";
    StyleCategory["Social"] = "social";
    StyleCategory["Educational"] = "educational";
    StyleCategory["Promotional"] = "promotional";
    StyleCategory["Cinematic"] = "cinematic";
    StyleCategory["Branded"] = "branded";
})(StyleCategory || (StyleCategory = {}));
export var CinematicStyleClass;
(function (CinematicStyleClass) {
    CinematicStyleClass["Commercial"] = "commercial";
    CinematicStyleClass["Documentary"] = "documentary";
    CinematicStyleClass["Corporate"] = "corporate";
    CinematicStyleClass["Luxury"] = "luxury";
    CinematicStyleClass["Modern"] = "modern";
    CinematicStyleClass["Minimal"] = "minimal";
    CinematicStyleClass["Technology"] = "technology";
    CinematicStyleClass["Fashion"] = "fashion";
    CinematicStyleClass["Food"] = "food";
    CinematicStyleClass["Beauty"] = "beauty";
    CinematicStyleClass["RealEstate"] = "real-estate";
    CinematicStyleClass["Education"] = "education";
    CinematicStyleClass["Healthcare"] = "healthcare";
    CinematicStyleClass["SocialMedia"] = "social-media";
    CinematicStyleClass["Entertainment"] = "entertainment";
})(CinematicStyleClass || (CinematicStyleClass = {}));
export var StyleTemplatePlatform;
(function (StyleTemplatePlatform) {
    StyleTemplatePlatform["ProductAds"] = "product-ads";
    StyleTemplatePlatform["SocialMedia"] = "social-media";
    StyleTemplatePlatform["Shorts"] = "shorts";
    StyleTemplatePlatform["Reels"] = "reels";
    StyleTemplatePlatform["TikTok"] = "tiktok";
    StyleTemplatePlatform["YouTube"] = "youtube";
    StyleTemplatePlatform["Website"] = "website";
    StyleTemplatePlatform["CorporateVideos"] = "corporate-videos";
})(StyleTemplatePlatform || (StyleTemplatePlatform = {}));
export class VideoStyleIntelligenceEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoStyleIntelligenceEngineError";
    }
}
//# sourceMappingURL=types.js.map