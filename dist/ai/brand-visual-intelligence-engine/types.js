/**
 * KWIZERA AI STUDIO — Brand Visual Intelligence Engine types (Step 6H)
 */
export var BrandVisualStyle;
(function (BrandVisualStyle) {
    BrandVisualStyle["Luxury"] = "luxury";
    BrandVisualStyle["Modern"] = "modern";
    BrandVisualStyle["Minimal"] = "minimal";
    BrandVisualStyle["Corporate"] = "corporate";
    BrandVisualStyle["Technology"] = "technology";
    BrandVisualStyle["Fashion"] = "fashion";
    BrandVisualStyle["Beauty"] = "beauty";
    BrandVisualStyle["Food"] = "food";
    BrandVisualStyle["RealEstate"] = "real-estate";
    BrandVisualStyle["Education"] = "education";
    BrandVisualStyle["Healthcare"] = "healthcare";
})(BrandVisualStyle || (BrandVisualStyle = {}));
export class BrandVisualIntelligenceEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "BrandVisualIntelligenceEngineError";
    }
}
//# sourceMappingURL=types.js.map