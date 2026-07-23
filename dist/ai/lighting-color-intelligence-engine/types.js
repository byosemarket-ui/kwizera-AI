/**
 * KWIZERA AI STUDIO — Lighting & Color Intelligence Engine types (Step 6G)
 */
export var LightingType;
(function (LightingType) {
    LightingType["Studio"] = "studio";
    LightingType["Natural"] = "natural";
    LightingType["Artificial"] = "artificial";
    LightingType["Mixed"] = "mixed";
    LightingType["Backlit"] = "backlit";
    LightingType["SideLit"] = "side-lit";
    LightingType["TopLit"] = "top-lit";
    LightingType["LowKey"] = "low-key";
    LightingType["HighKey"] = "high-key";
})(LightingType || (LightingType = {}));
export var LightingDirection;
(function (LightingDirection) {
    LightingDirection["Front"] = "front";
    LightingDirection["Side"] = "side";
    LightingDirection["Back"] = "back";
    LightingDirection["Top"] = "top";
    LightingDirection["Diffused"] = "diffused";
    LightingDirection["Mixed"] = "mixed";
})(LightingDirection || (LightingDirection = {}));
export var ColorTemperature;
(function (ColorTemperature) {
    ColorTemperature["Warm"] = "warm";
    ColorTemperature["Neutral"] = "neutral";
    ColorTemperature["Cool"] = "cool";
})(ColorTemperature || (ColorTemperature = {}));
export var LightingColorMarketingGoal;
(function (LightingColorMarketingGoal) {
    LightingColorMarketingGoal["Conversion"] = "conversion";
    LightingColorMarketingGoal["Awareness"] = "awareness";
    LightingColorMarketingGoal["Engagement"] = "engagement";
    LightingColorMarketingGoal["Retention"] = "retention";
    LightingColorMarketingGoal["Launch"] = "launch";
    LightingColorMarketingGoal["Education"] = "education";
})(LightingColorMarketingGoal || (LightingColorMarketingGoal = {}));
export class LightingColorIntelligenceEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "LightingColorIntelligenceEngineError";
    }
}
//# sourceMappingURL=types.js.map