/**
 * KWIZERA AI STUDIO — Image Understanding Engine types (Step 6C)
 */
export var ImageUnderstandingMarketingGoal;
(function (ImageUnderstandingMarketingGoal) {
    ImageUnderstandingMarketingGoal["Conversion"] = "conversion";
    ImageUnderstandingMarketingGoal["Awareness"] = "awareness";
    ImageUnderstandingMarketingGoal["Engagement"] = "engagement";
    ImageUnderstandingMarketingGoal["Retention"] = "retention";
    ImageUnderstandingMarketingGoal["Launch"] = "launch";
    ImageUnderstandingMarketingGoal["Education"] = "education";
})(ImageUnderstandingMarketingGoal || (ImageUnderstandingMarketingGoal = {}));
export var ImageSceneType;
(function (ImageSceneType) {
    ImageSceneType["Indoor"] = "indoor";
    ImageSceneType["Outdoor"] = "outdoor";
    ImageSceneType["Studio"] = "studio";
    ImageSceneType["Lifestyle"] = "lifestyle";
    ImageSceneType["Commercial"] = "commercial";
    ImageSceneType["ProductShowcase"] = "product-showcase";
    ImageSceneType["Promotional"] = "promotional";
    ImageSceneType["BackgroundContext"] = "background-context";
})(ImageSceneType || (ImageSceneType = {}));
export var ImageUnderstandingPlatform;
(function (ImageUnderstandingPlatform) {
    ImageUnderstandingPlatform["Web"] = "web";
    ImageUnderstandingPlatform["Social"] = "social";
    ImageUnderstandingPlatform["Ecommerce"] = "ecommerce";
    ImageUnderstandingPlatform["Print"] = "print";
    ImageUnderstandingPlatform["Mobile"] = "mobile";
    ImageUnderstandingPlatform["MultiPlatform"] = "multi-platform";
})(ImageUnderstandingPlatform || (ImageUnderstandingPlatform = {}));
export class ImageUnderstandingEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageUnderstandingEngineError";
    }
}
//# sourceMappingURL=types.js.map