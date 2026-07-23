/**
 * KWIZERA AI STUDIO — Brand Knowledge Engine types (Step 4I)
 */
export var KnowledgeBrandIndustry;
(function (KnowledgeBrandIndustry) {
    KnowledgeBrandIndustry["Technology"] = "technology";
    KnowledgeBrandIndustry["Creative"] = "creative";
    KnowledgeBrandIndustry["Fashion"] = "fashion";
    KnowledgeBrandIndustry["Beauty"] = "beauty";
    KnowledgeBrandIndustry["Food"] = "food";
    KnowledgeBrandIndustry["Hospitality"] = "hospitality";
    KnowledgeBrandIndustry["Education"] = "education";
    KnowledgeBrandIndustry["Health"] = "health";
    KnowledgeBrandIndustry["Automotive"] = "automotive";
    KnowledgeBrandIndustry["RealEstate"] = "real-estate";
    KnowledgeBrandIndustry["General"] = "general";
    KnowledgeBrandIndustry["Future"] = "future";
})(KnowledgeBrandIndustry || (KnowledgeBrandIndustry = {}));
export var BrandMarketingStyle;
(function (BrandMarketingStyle) {
    BrandMarketingStyle["Premium"] = "premium";
    BrandMarketingStyle["Playful"] = "playful";
    BrandMarketingStyle["Professional"] = "professional";
    BrandMarketingStyle["Emotional"] = "emotional";
    BrandMarketingStyle["Minimal"] = "minimal";
    BrandMarketingStyle["Bold"] = "bold";
})(BrandMarketingStyle || (BrandMarketingStyle = {}));
export class BrandKnowledgeEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "BrandKnowledgeEngineError";
    }
}
//# sourceMappingURL=types.js.map