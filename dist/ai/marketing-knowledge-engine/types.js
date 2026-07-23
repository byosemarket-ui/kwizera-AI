/**
 * KWIZERA AI STUDIO — Marketing Knowledge Engine types (Step 4G)
 */
export var KnowledgeMarketingPlatform;
(function (KnowledgeMarketingPlatform) {
    KnowledgeMarketingPlatform["TikTok"] = "tiktok";
    KnowledgeMarketingPlatform["Instagram"] = "instagram";
    KnowledgeMarketingPlatform["Facebook"] = "facebook";
    KnowledgeMarketingPlatform["YouTube"] = "youtube";
    KnowledgeMarketingPlatform["WhatsApp"] = "whatsapp";
    KnowledgeMarketingPlatform["Website"] = "website";
    KnowledgeMarketingPlatform["Future"] = "future";
})(KnowledgeMarketingPlatform || (KnowledgeMarketingPlatform = {}));
export var KnowledgeCampaignType;
(function (KnowledgeCampaignType) {
    KnowledgeCampaignType["ProductLaunch"] = "product-launch";
    KnowledgeCampaignType["BrandAwareness"] = "brand-awareness";
    KnowledgeCampaignType["Conversion"] = "conversion";
    KnowledgeCampaignType["Engagement"] = "engagement";
    KnowledgeCampaignType["Retargeting"] = "retargeting";
    KnowledgeCampaignType["ContentMarketing"] = "content-marketing";
    KnowledgeCampaignType["Ecommerce"] = "ecommerce";
    KnowledgeCampaignType["SocialMedia"] = "social-media";
    KnowledgeCampaignType["VideoMarketing"] = "video-marketing";
})(KnowledgeCampaignType || (KnowledgeCampaignType = {}));
export var KnowledgeMarketingGoal;
(function (KnowledgeMarketingGoal) {
    KnowledgeMarketingGoal["Conversion"] = "conversion";
    KnowledgeMarketingGoal["Awareness"] = "awareness";
    KnowledgeMarketingGoal["Engagement"] = "engagement";
    KnowledgeMarketingGoal["Retention"] = "retention";
    KnowledgeMarketingGoal["LeadGeneration"] = "lead-generation";
    KnowledgeMarketingGoal["BrandBuilding"] = "brand-building";
})(KnowledgeMarketingGoal || (KnowledgeMarketingGoal = {}));
export var MarketingStyle;
(function (MarketingStyle) {
    MarketingStyle["Emotional"] = "emotional";
    MarketingStyle["Rational"] = "rational";
    MarketingStyle["StoryDriven"] = "story-driven";
    MarketingStyle["DirectResponse"] = "direct-response";
    MarketingStyle["Educational"] = "educational";
    MarketingStyle["Premium"] = "premium";
})(MarketingStyle || (MarketingStyle = {}));
export class MarketingKnowledgeEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MarketingKnowledgeEngineError";
    }
}
//# sourceMappingURL=types.js.map