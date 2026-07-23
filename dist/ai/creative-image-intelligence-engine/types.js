/**

 * KWIZERA AI STUDIO — Creative Image Intelligence Engine types (Step 6J)

 */
export var CreativeImagePlatform;
(function (CreativeImagePlatform) {
    CreativeImagePlatform["InstagramPost"] = "instagram-post";
    CreativeImagePlatform["InstagramStory"] = "instagram-story";
    CreativeImagePlatform["InstagramReelCover"] = "instagram-reel-cover";
    CreativeImagePlatform["FacebookPost"] = "facebook-post";
    CreativeImagePlatform["FacebookStory"] = "facebook-story";
    CreativeImagePlatform["TikTokCover"] = "tiktok-cover";
    CreativeImagePlatform["YouTubeThumbnail"] = "youtube-thumbnail";
    CreativeImagePlatform["YouTubeCommunity"] = "youtube-community";
    CreativeImagePlatform["WhatsAppStatus"] = "whatsapp-status";
    CreativeImagePlatform["WebsiteBanner"] = "website-banner";
})(CreativeImagePlatform || (CreativeImagePlatform = {}));
export var CreativeLayoutType;
(function (CreativeLayoutType) {
    CreativeLayoutType["Poster"] = "poster";
    CreativeLayoutType["Advertisement"] = "advertisement";
    CreativeLayoutType["Thumbnail"] = "thumbnail";
    CreativeLayoutType["Banner"] = "banner";
    CreativeLayoutType["SocialMedia"] = "social-media";
    CreativeLayoutType["Branding"] = "branding";
    CreativeLayoutType["ProductShowcase"] = "product-showcase";
})(CreativeLayoutType || (CreativeLayoutType = {}));
export var CreativeStyleCategory;
(function (CreativeStyleCategory) {
    CreativeStyleCategory["Luxury"] = "luxury";
    CreativeStyleCategory["Premium"] = "premium";
    CreativeStyleCategory["Modern"] = "modern";
    CreativeStyleCategory["Minimal"] = "minimal";
    CreativeStyleCategory["Corporate"] = "corporate";
    CreativeStyleCategory["Technology"] = "technology";
    CreativeStyleCategory["Fashion"] = "fashion";
    CreativeStyleCategory["Beauty"] = "beauty";
    CreativeStyleCategory["Food"] = "food";
    CreativeStyleCategory["Restaurant"] = "restaurant";
    CreativeStyleCategory["Electronics"] = "electronics";
    CreativeStyleCategory["RealEstate"] = "real-estate";
    CreativeStyleCategory["Education"] = "education";
    CreativeStyleCategory["Healthcare"] = "healthcare";
})(CreativeStyleCategory || (CreativeStyleCategory = {}));
export var MarketingLayoutType;
(function (MarketingLayoutType) {
    MarketingLayoutType["Promotional"] = "promotional";
    MarketingLayoutType["ProductShowcase"] = "product-showcase";
    MarketingLayoutType["Offer"] = "offer";
    MarketingLayoutType["Discount"] = "discount";
    MarketingLayoutType["LaunchCampaign"] = "launch-campaign";
    MarketingLayoutType["SeasonalCampaign"] = "seasonal-campaign";
    MarketingLayoutType["BrandAwareness"] = "brand-awareness";
    MarketingLayoutType["LeadGeneration"] = "lead-generation";
})(MarketingLayoutType || (MarketingLayoutType = {}));
export class CreativeImageIntelligenceEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "CreativeImageIntelligenceEngineError";
    }
}
//# sourceMappingURL=types.js.map