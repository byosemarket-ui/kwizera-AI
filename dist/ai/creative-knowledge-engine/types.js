/**
 * KWIZERA AI STUDIO — Creative Knowledge Engine types (Step 4K)
 */
export var KnowledgeCreativeDomain;
(function (KnowledgeCreativeDomain) {
    KnowledgeCreativeDomain["GraphicDesign"] = "graphic-design";
    KnowledgeCreativeDomain["MotionGraphics"] = "motion-graphics";
    KnowledgeCreativeDomain["VideoEditing"] = "video-editing";
    KnowledgeCreativeDomain["Storyboarding"] = "storyboarding";
    KnowledgeCreativeDomain["AdvertisingDesign"] = "advertising-design";
    KnowledgeCreativeDomain["PosterDesign"] = "poster-design";
    KnowledgeCreativeDomain["SocialMediaDesign"] = "social-media-design";
    KnowledgeCreativeDomain["ThumbnailDesign"] = "thumbnail-design";
    KnowledgeCreativeDomain["ProductShowcase"] = "product-showcase";
    KnowledgeCreativeDomain["PresentationDesign"] = "presentation-design";
    KnowledgeCreativeDomain["UIInspiration"] = "ui-inspiration";
    KnowledgeCreativeDomain["CreativeDirection"] = "creative-direction";
})(KnowledgeCreativeDomain || (KnowledgeCreativeDomain = {}));
export var KnowledgeCreativeDirectionStyle;
(function (KnowledgeCreativeDirectionStyle) {
    KnowledgeCreativeDirectionStyle["Minimal"] = "minimal";
    KnowledgeCreativeDirectionStyle["Bold"] = "bold";
    KnowledgeCreativeDirectionStyle["Cinematic"] = "cinematic";
    KnowledgeCreativeDirectionStyle["Commercial"] = "commercial";
    KnowledgeCreativeDirectionStyle["Editorial"] = "editorial";
    KnowledgeCreativeDirectionStyle["Playful"] = "playful";
    KnowledgeCreativeDirectionStyle["Premium"] = "premium";
    KnowledgeCreativeDirectionStyle["Futuristic"] = "futuristic";
})(KnowledgeCreativeDirectionStyle || (KnowledgeCreativeDirectionStyle = {}));
export var KnowledgeCreativePlatform;
(function (KnowledgeCreativePlatform) {
    KnowledgeCreativePlatform["TikTok"] = "tiktok";
    KnowledgeCreativePlatform["Instagram"] = "instagram";
    KnowledgeCreativePlatform["Facebook"] = "facebook";
    KnowledgeCreativePlatform["YouTube"] = "youtube";
    KnowledgeCreativePlatform["YouTubeShorts"] = "youtube-shorts";
    KnowledgeCreativePlatform["WhatsApp"] = "whatsapp";
    KnowledgeCreativePlatform["Future"] = "future";
})(KnowledgeCreativePlatform || (KnowledgeCreativePlatform = {}));
export var KnowledgeCreativeMarketingGoal;
(function (KnowledgeCreativeMarketingGoal) {
    KnowledgeCreativeMarketingGoal["Conversion"] = "conversion";
    KnowledgeCreativeMarketingGoal["Awareness"] = "awareness";
    KnowledgeCreativeMarketingGoal["Engagement"] = "engagement";
    KnowledgeCreativeMarketingGoal["BrandBuilding"] = "brand-building";
})(KnowledgeCreativeMarketingGoal || (KnowledgeCreativeMarketingGoal = {}));
export class CreativeKnowledgeEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "CreativeKnowledgeEngineError";
    }
}
//# sourceMappingURL=types.js.map