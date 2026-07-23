/**
 * KWIZERA AI STUDIO — Marketing Memory Engine types (Step 3H)
 */
export var MarketingPlatform;
(function (MarketingPlatform) {
    MarketingPlatform["TikTok"] = "tiktok";
    MarketingPlatform["InstagramReels"] = "instagram-reels";
    MarketingPlatform["Facebook"] = "facebook";
    MarketingPlatform["YouTubeShorts"] = "youtube-shorts";
    MarketingPlatform["YouTubeLong"] = "youtube-long";
    MarketingPlatform["WhatsAppStatus"] = "whatsapp-status";
    MarketingPlatform["Website"] = "website";
    MarketingPlatform["Email"] = "email";
    MarketingPlatform["Other"] = "other";
})(MarketingPlatform || (MarketingPlatform = {}));
export var CampaignType;
(function (CampaignType) {
    CampaignType["ProductLaunch"] = "product-launch";
    CampaignType["BrandAwareness"] = "brand-awareness";
    CampaignType["Conversion"] = "conversion";
    CampaignType["Engagement"] = "engagement";
    CampaignType["Retargeting"] = "retargeting";
    CampaignType["Seasonal"] = "seasonal";
    CampaignType["General"] = "general";
})(CampaignType || (CampaignType = {}));
export var CampaignStatus;
(function (CampaignStatus) {
    CampaignStatus["Draft"] = "draft";
    CampaignStatus["Active"] = "active";
    CampaignStatus["Paused"] = "paused";
    CampaignStatus["Completed"] = "completed";
    CampaignStatus["Archived"] = "archived";
})(CampaignStatus || (CampaignStatus = {}));
export class MarketingMemoryEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MarketingMemoryEngineError";
    }
}
//# sourceMappingURL=types.js.map