/**
 * KWIZERA AI STUDIO — Text-to-Image Generation Engine types (Step 9B)
 */
export var TextToImagePlatform;
(function (TextToImagePlatform) {
    TextToImagePlatform["Website"] = "website";
    TextToImagePlatform["Mobile"] = "mobile";
    TextToImagePlatform["Instagram"] = "instagram";
    TextToImagePlatform["Facebook"] = "facebook";
    TextToImagePlatform["TikTok"] = "tiktok";
    TextToImagePlatform["LinkedIn"] = "linkedin";
    TextToImagePlatform["Print"] = "print";
    TextToImagePlatform["Billboard"] = "billboard";
})(TextToImagePlatform || (TextToImagePlatform = {}));
export var TextToImageInputType;
(function (TextToImageInputType) {
    TextToImageInputType["TextPrompt"] = "text-prompt";
    TextToImageInputType["ProductInformation"] = "product-information";
    TextToImageInputType["BrandGuidelines"] = "brand-guidelines";
    TextToImageInputType["Campaign"] = "campaign";
    TextToImageInputType["StyleReferences"] = "style-references";
    TextToImageInputType["KnowledgeRecord"] = "knowledge-record";
})(TextToImageInputType || (TextToImageInputType = {}));
export var ImageArtisticStyle;
(function (ImageArtisticStyle) {
    ImageArtisticStyle["Photorealistic"] = "photorealistic";
    ImageArtisticStyle["Commercial"] = "commercial";
    ImageArtisticStyle["Luxury"] = "luxury";
    ImageArtisticStyle["Corporate"] = "corporate";
    ImageArtisticStyle["Cartoon"] = "cartoon";
    ImageArtisticStyle["Illustration"] = "illustration";
    ImageArtisticStyle["ThreeDRender"] = "3d-render";
    ImageArtisticStyle["Minimal"] = "minimal";
    ImageArtisticStyle["Fashion"] = "fashion";
    ImageArtisticStyle["ProductPhotography"] = "product-photography";
})(ImageArtisticStyle || (ImageArtisticStyle = {}));
export var ProductImageType;
(function (ProductImageType) {
    ProductImageType["HeroImage"] = "hero-image";
    ProductImageType["ProductShowcase"] = "product-showcase";
    ProductImageType["LifestyleImage"] = "lifestyle-image";
    ProductImageType["PackagingView"] = "packaging-view";
    ProductImageType["CloseUp"] = "close-up";
    ProductImageType["DetailView"] = "detail-view";
})(ProductImageType || (ProductImageType = {}));
export var ImageVariationType;
(function (ImageVariationType) {
    ImageVariationType["VariationA"] = "variation-a";
    ImageVariationType["VariationB"] = "variation-b";
    ImageVariationType["VariationC"] = "variation-c";
    ImageVariationType["StyleVariation"] = "style-variation";
    ImageVariationType["CompositionVariation"] = "composition-variation";
    ImageVariationType["ColorVariation"] = "color-variation";
})(ImageVariationType || (ImageVariationType = {}));
export class TextToImageGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "TextToImageGenerationEngineError";
    }
}
export const ALL_TEXT_TO_IMAGE_PLATFORMS = [
    TextToImagePlatform.Website,
    TextToImagePlatform.Mobile,
    TextToImagePlatform.Instagram,
    TextToImagePlatform.Facebook,
    TextToImagePlatform.TikTok,
    TextToImagePlatform.LinkedIn,
    TextToImagePlatform.Print,
    TextToImagePlatform.Billboard,
];
export const PLATFORM_CONFIG = {
    [TextToImagePlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
    [TextToImagePlatform.Mobile]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [TextToImagePlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
    [TextToImagePlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
    [TextToImagePlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [TextToImagePlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
    [TextToImagePlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
    [TextToImagePlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
};
//# sourceMappingURL=types.js.map