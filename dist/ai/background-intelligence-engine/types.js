/**
 * KWIZERA AI STUDIO — Background Intelligence Engine types (Step 6E)
 */
export var BackgroundType;
(function (BackgroundType) {
    BackgroundType["Studio"] = "studio";
    BackgroundType["Lifestyle"] = "lifestyle";
    BackgroundType["Indoor"] = "indoor";
    BackgroundType["Outdoor"] = "outdoor";
    BackgroundType["Nature"] = "nature";
    BackgroundType["Office"] = "office";
    BackgroundType["Commercial"] = "commercial";
    BackgroundType["Transparent"] = "transparent";
    BackgroundType["Gradient"] = "gradient";
    BackgroundType["Abstract"] = "abstract";
    BackgroundType["Custom"] = "custom";
})(BackgroundType || (BackgroundType = {}));
export var BackgroundComplexity;
(function (BackgroundComplexity) {
    BackgroundComplexity["Minimal"] = "minimal";
    BackgroundComplexity["Low"] = "low";
    BackgroundComplexity["Medium"] = "medium";
    BackgroundComplexity["High"] = "high";
    BackgroundComplexity["VeryHigh"] = "very-high";
})(BackgroundComplexity || (BackgroundComplexity = {}));
export var BackgroundMarketingGoal;
(function (BackgroundMarketingGoal) {
    BackgroundMarketingGoal["Conversion"] = "conversion";
    BackgroundMarketingGoal["Awareness"] = "awareness";
    BackgroundMarketingGoal["Engagement"] = "engagement";
    BackgroundMarketingGoal["Retention"] = "retention";
    BackgroundMarketingGoal["Launch"] = "launch";
    BackgroundMarketingGoal["Education"] = "education";
})(BackgroundMarketingGoal || (BackgroundMarketingGoal = {}));
export class BackgroundIntelligenceEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "BackgroundIntelligenceEngineError";
    }
}
//# sourceMappingURL=types.js.map