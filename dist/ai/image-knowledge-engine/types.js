/**
 * KWIZERA AI STUDIO — Image Knowledge Engine types (Step 4E)
 */
export var ImageType;
(function (ImageType) {
    ImageType["Product"] = "product";
    ImageType["Lifestyle"] = "lifestyle";
    ImageType["Marketing"] = "marketing";
    ImageType["Brand"] = "brand";
    ImageType["Packaging"] = "packaging";
    ImageType["Banner"] = "banner";
    ImageType["Social"] = "social";
    ImageType["Catalog"] = "catalog";
    ImageType["Other"] = "other";
})(ImageType || (ImageType = {}));
export var CreativeStyle;
(function (CreativeStyle) {
    CreativeStyle["Modern"] = "modern";
    CreativeStyle["Luxury"] = "luxury";
    CreativeStyle["Minimal"] = "minimal";
    CreativeStyle["Commercial"] = "commercial";
    CreativeStyle["Editorial"] = "editorial";
    CreativeStyle["Rustic"] = "rustic";
})(CreativeStyle || (CreativeStyle = {}));
export class ImageKnowledgeEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageKnowledgeEngineError";
    }
}
//# sourceMappingURL=types.js.map