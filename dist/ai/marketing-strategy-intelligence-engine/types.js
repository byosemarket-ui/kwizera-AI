/**
 * KWIZERA AI STUDIO — Marketing Strategy Intelligence Engine types (Step 5E)
 */
export var MarketingObjective;
(function (MarketingObjective) {
    MarketingObjective["BrandAwareness"] = "brand-awareness";
    MarketingObjective["ProductPromotion"] = "product-promotion";
    MarketingObjective["ProductLaunch"] = "product-launch";
    MarketingObjective["SalesGrowth"] = "sales-growth";
    MarketingObjective["CustomerEngagement"] = "customer-engagement";
    MarketingObjective["CustomerRetention"] = "customer-retention";
    MarketingObjective["LeadGeneration"] = "lead-generation";
    MarketingObjective["EventPromotion"] = "event-promotion";
    MarketingObjective["BusinessPromotion"] = "business-promotion";
    MarketingObjective["ServicePromotion"] = "service-promotion";
})(MarketingObjective || (MarketingObjective = {}));
export var BusinessGoalType;
(function (BusinessGoalType) {
    BusinessGoalType["Sales"] = "sales-objectives";
    BusinessGoalType["Marketing"] = "marketing-objectives";
    BusinessGoalType["Brand"] = "brand-objectives";
    BusinessGoalType["Customer"] = "customer-objectives";
    BusinessGoalType["Growth"] = "growth-objectives";
    BusinessGoalType["Communication"] = "communication-objectives";
})(BusinessGoalType || (BusinessGoalType = {}));
export var StrategyType;
(function (StrategyType) {
    StrategyType["Emotional"] = "emotional-marketing";
    StrategyType["Educational"] = "educational-marketing";
    StrategyType["Promotional"] = "promotional-marketing";
    StrategyType["Storytelling"] = "storytelling-marketing";
    StrategyType["Demonstration"] = "demonstration-marketing";
    StrategyType["Luxury"] = "luxury-marketing";
    StrategyType["Lifestyle"] = "lifestyle-marketing";
    StrategyType["SocialProof"] = "social-proof-strategy";
    StrategyType["ValueBased"] = "value-based-strategy";
    StrategyType["ProblemSolution"] = "problem-solution-strategy";
})(StrategyType || (StrategyType = {}));
export var StrategyMarketingPlatform;
(function (StrategyMarketingPlatform) {
    StrategyMarketingPlatform["Instagram"] = "instagram";
    StrategyMarketingPlatform["YouTube"] = "youtube";
    StrategyMarketingPlatform["TikTok"] = "tiktok";
    StrategyMarketingPlatform["Facebook"] = "facebook";
    StrategyMarketingPlatform["WhatsApp"] = "whatsapp";
    StrategyMarketingPlatform["Website"] = "website";
    StrategyMarketingPlatform["LinkedIn"] = "linkedin";
    StrategyMarketingPlatform["Email"] = "email";
    StrategyMarketingPlatform["InStore"] = "in-store";
    StrategyMarketingPlatform["Future"] = "future-platforms";
})(StrategyMarketingPlatform || (StrategyMarketingPlatform = {}));
export class MarketingStrategyEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MarketingStrategyEngineError";
    }
}
//# sourceMappingURL=types.js.map