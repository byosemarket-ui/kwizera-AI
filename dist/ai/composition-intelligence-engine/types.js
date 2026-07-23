/**
 * KWIZERA AI STUDIO — Composition Intelligence Engine types (Step 6F)
 */
export var CompositionType;
(function (CompositionType) {
    CompositionType["RuleOfThirds"] = "rule-of-thirds";
    CompositionType["Center"] = "center";
    CompositionType["Symmetry"] = "symmetry";
    CompositionType["Asymmetry"] = "asymmetry";
    CompositionType["Dynamic"] = "dynamic";
    CompositionType["Minimal"] = "minimal";
    CompositionType["Layered"] = "layered";
})(CompositionType || (CompositionType = {}));
export var CompositionMarketingGoal;
(function (CompositionMarketingGoal) {
    CompositionMarketingGoal["Conversion"] = "conversion";
    CompositionMarketingGoal["Awareness"] = "awareness";
    CompositionMarketingGoal["Engagement"] = "engagement";
    CompositionMarketingGoal["Retention"] = "retention";
    CompositionMarketingGoal["Launch"] = "launch";
    CompositionMarketingGoal["Education"] = "education";
})(CompositionMarketingGoal || (CompositionMarketingGoal = {}));
export var CompositionPlatform;
(function (CompositionPlatform) {
    CompositionPlatform["Web"] = "web";
    CompositionPlatform["Social"] = "social";
    CompositionPlatform["Ecommerce"] = "ecommerce";
    CompositionPlatform["Print"] = "print";
    CompositionPlatform["Mobile"] = "mobile";
    CompositionPlatform["MultiPlatform"] = "multi-platform";
})(CompositionPlatform || (CompositionPlatform = {}));
export class CompositionIntelligenceEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "CompositionIntelligenceEngineError";
    }
}
//# sourceMappingURL=types.js.map