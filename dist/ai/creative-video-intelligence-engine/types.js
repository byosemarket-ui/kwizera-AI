/**
 * KWIZERA AI STUDIO — Creative Video Intelligence Engine types (Step 7J)
 */
export var CreativeVideoPlatform;
(function (CreativeVideoPlatform) {
    CreativeVideoPlatform["TikTok"] = "tiktok";
    CreativeVideoPlatform["InstagramReels"] = "instagram-reels";
    CreativeVideoPlatform["Facebook"] = "facebook";
    CreativeVideoPlatform["YouTube"] = "youtube";
    CreativeVideoPlatform["WhatsApp"] = "whatsapp";
    CreativeVideoPlatform["Website"] = "website";
    CreativeVideoPlatform["Television"] = "television";
})(CreativeVideoPlatform || (CreativeVideoPlatform = {}));
export var CreativeVideoTemplateType;
(function (CreativeVideoTemplateType) {
    CreativeVideoTemplateType["ProductAdvertisement"] = "product-advertisement";
    CreativeVideoTemplateType["BrandAdvertisement"] = "brand-advertisement";
    CreativeVideoTemplateType["LaunchCampaign"] = "launch-campaign";
    CreativeVideoTemplateType["Restaurant"] = "restaurant";
    CreativeVideoTemplateType["Fashion"] = "fashion";
    CreativeVideoTemplateType["Beauty"] = "beauty";
    CreativeVideoTemplateType["Electronics"] = "electronics";
    CreativeVideoTemplateType["Education"] = "education";
    CreativeVideoTemplateType["Healthcare"] = "healthcare";
    CreativeVideoTemplateType["RealEstate"] = "real-estate";
})(CreativeVideoTemplateType || (CreativeVideoTemplateType = {}));
export var CreativeVideoType;
(function (CreativeVideoType) {
    CreativeVideoType["Commercial"] = "commercial";
    CreativeVideoType["Social"] = "social";
    CreativeVideoType["Educational"] = "educational";
    CreativeVideoType["Promotional"] = "promotional";
    CreativeVideoType["BrandStory"] = "brand-story";
    CreativeVideoType["ProductDemo"] = "product-demo";
})(CreativeVideoType || (CreativeVideoType = {}));
export class CreativeVideoIntelligenceEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "CreativeVideoIntelligenceEngineError";
    }
}
//# sourceMappingURL=types.js.map