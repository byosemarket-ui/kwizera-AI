/**
 * KWIZERA AI STUDIO — Multi-Style Image Generation Engine types (Step 9I)
 */
export var MultiStyleGenPlatform;
(function (MultiStyleGenPlatform) {
    MultiStyleGenPlatform["Website"] = "website";
    MultiStyleGenPlatform["Mobile"] = "mobile";
    MultiStyleGenPlatform["Instagram"] = "instagram";
    MultiStyleGenPlatform["Facebook"] = "facebook";
    MultiStyleGenPlatform["TikTok"] = "tiktok";
    MultiStyleGenPlatform["LinkedIn"] = "linkedin";
    MultiStyleGenPlatform["Print"] = "print";
    MultiStyleGenPlatform["Catalogue"] = "catalogue";
    MultiStyleGenPlatform["Billboard"] = "billboard";
})(MultiStyleGenPlatform || (MultiStyleGenPlatform = {}));
export var MultiStyleGenInputType;
(function (MultiStyleGenInputType) {
    MultiStyleGenInputType["Prompt"] = "prompt";
    MultiStyleGenInputType["SourceImage"] = "source-image";
    MultiStyleGenInputType["ProductImage"] = "product-image";
    MultiStyleGenInputType["BrandGuidelines"] = "brand-guidelines";
    MultiStyleGenInputType["Campaign"] = "campaign";
    MultiStyleGenInputType["StyleReference"] = "style-reference";
    MultiStyleGenInputType["Template"] = "template";
    MultiStyleGenInputType["KnowledgeRecord"] = "knowledge-record";
})(MultiStyleGenInputType || (MultiStyleGenInputType = {}));
export var MultiStyleImageCategory;
(function (MultiStyleImageCategory) {
    MultiStyleImageCategory["Photorealistic"] = "photorealistic";
    MultiStyleImageCategory["Commercial"] = "commercial";
    MultiStyleImageCategory["Luxury"] = "luxury";
    MultiStyleImageCategory["Corporate"] = "corporate";
    MultiStyleImageCategory["StudioPhotography"] = "studio-photography";
    MultiStyleImageCategory["ProductPhotography"] = "product-photography";
    MultiStyleImageCategory["Lifestyle"] = "lifestyle";
    MultiStyleImageCategory["Editorial"] = "editorial";
    MultiStyleImageCategory["Fashion"] = "fashion";
    MultiStyleImageCategory["FoodPhotography"] = "food-photography";
    MultiStyleImageCategory["RealEstate"] = "real-estate";
    MultiStyleImageCategory["Architecture"] = "architecture";
    MultiStyleImageCategory["Medical"] = "medical";
    MultiStyleImageCategory["Technology"] = "technology";
    MultiStyleImageCategory["Cartoon"] = "cartoon";
    MultiStyleImageCategory["Illustration"] = "illustration";
    MultiStyleImageCategory["Watercolor"] = "watercolor";
    MultiStyleImageCategory["OilPainting"] = "oil-painting";
    MultiStyleImageCategory["PencilSketch"] = "pencil-sketch";
    MultiStyleImageCategory["InkDrawing"] = "ink-drawing";
    MultiStyleImageCategory["LowPoly"] = "low-poly";
    MultiStyleImageCategory["Render3D"] = "3d-render";
    MultiStyleImageCategory["ClayRender"] = "clay-render";
    MultiStyleImageCategory["Isometric"] = "isometric";
    MultiStyleImageCategory["PixelArt"] = "pixel-art";
    MultiStyleImageCategory["Anime"] = "anime";
    MultiStyleImageCategory["Comic"] = "comic";
    MultiStyleImageCategory["Minimal"] = "minimal";
    MultiStyleImageCategory["FlatDesign"] = "flat-design";
    MultiStyleImageCategory["Abstract"] = "abstract";
    MultiStyleImageCategory["Vintage"] = "vintage";
    MultiStyleImageCategory["Futuristic"] = "futuristic";
})(MultiStyleImageCategory || (MultiStyleImageCategory = {}));
export var MultiStyleVariationType;
(function (MultiStyleVariationType) {
    MultiStyleVariationType["StyleVersionA"] = "style-version-a";
    MultiStyleVariationType["StyleVersionB"] = "style-version-b";
    MultiStyleVariationType["StyleVersionC"] = "style-version-c";
    MultiStyleVariationType["PremiumVersion"] = "premium-version";
    MultiStyleVariationType["CommercialVersion"] = "commercial-version";
    MultiStyleVariationType["SocialMediaVersion"] = "social-media-version";
    MultiStyleVariationType["PrintVersion"] = "print-version";
})(MultiStyleVariationType || (MultiStyleVariationType = {}));
export var MultiStyleIdentityTarget;
(function (MultiStyleIdentityTarget) {
    MultiStyleIdentityTarget["HumanIdentity"] = "human-identity";
    MultiStyleIdentityTarget["ProductIdentity"] = "product-identity";
    MultiStyleIdentityTarget["LogoIntegrity"] = "logo-integrity";
    MultiStyleIdentityTarget["PackagingIntegrity"] = "packaging-integrity";
    MultiStyleIdentityTarget["BrandColors"] = "brand-colors";
    MultiStyleIdentityTarget["Typography"] = "typography";
    MultiStyleIdentityTarget["VisualIdentity"] = "visual-identity";
})(MultiStyleIdentityTarget || (MultiStyleIdentityTarget = {}));
export class MultiStyleImageEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MultiStyleImageEngineError";
    }
}
export const ALL_MULTI_STYLE_IMAGE_CATEGORIES = [
    MultiStyleImageCategory.Photorealistic,
    MultiStyleImageCategory.Commercial,
    MultiStyleImageCategory.Luxury,
    MultiStyleImageCategory.Corporate,
    MultiStyleImageCategory.StudioPhotography,
    MultiStyleImageCategory.ProductPhotography,
    MultiStyleImageCategory.Lifestyle,
    MultiStyleImageCategory.Editorial,
    MultiStyleImageCategory.Fashion,
    MultiStyleImageCategory.FoodPhotography,
    MultiStyleImageCategory.RealEstate,
    MultiStyleImageCategory.Architecture,
    MultiStyleImageCategory.Medical,
    MultiStyleImageCategory.Technology,
    MultiStyleImageCategory.Cartoon,
    MultiStyleImageCategory.Illustration,
    MultiStyleImageCategory.Watercolor,
    MultiStyleImageCategory.OilPainting,
    MultiStyleImageCategory.PencilSketch,
    MultiStyleImageCategory.InkDrawing,
    MultiStyleImageCategory.LowPoly,
    MultiStyleImageCategory.Render3D,
    MultiStyleImageCategory.ClayRender,
    MultiStyleImageCategory.Isometric,
    MultiStyleImageCategory.PixelArt,
    MultiStyleImageCategory.Anime,
    MultiStyleImageCategory.Comic,
    MultiStyleImageCategory.Minimal,
    MultiStyleImageCategory.FlatDesign,
    MultiStyleImageCategory.Abstract,
    MultiStyleImageCategory.Vintage,
    MultiStyleImageCategory.Futuristic,
];
export const ALL_MULTI_STYLE_VARIATION_TYPES = [
    MultiStyleVariationType.StyleVersionA,
    MultiStyleVariationType.StyleVersionB,
    MultiStyleVariationType.StyleVersionC,
    MultiStyleVariationType.PremiumVersion,
    MultiStyleVariationType.CommercialVersion,
    MultiStyleVariationType.SocialMediaVersion,
    MultiStyleVariationType.PrintVersion,
];
export const ALL_MULTI_STYLE_IDENTITY_TARGETS = [
    MultiStyleIdentityTarget.HumanIdentity,
    MultiStyleIdentityTarget.ProductIdentity,
    MultiStyleIdentityTarget.LogoIntegrity,
    MultiStyleIdentityTarget.PackagingIntegrity,
    MultiStyleIdentityTarget.BrandColors,
    MultiStyleIdentityTarget.Typography,
    MultiStyleIdentityTarget.VisualIdentity,
];
export const ALL_MULTI_STYLE_GEN_PLATFORMS = [
    MultiStyleGenPlatform.Website,
    MultiStyleGenPlatform.Mobile,
    MultiStyleGenPlatform.Instagram,
    MultiStyleGenPlatform.Facebook,
    MultiStyleGenPlatform.TikTok,
    MultiStyleGenPlatform.LinkedIn,
    MultiStyleGenPlatform.Print,
    MultiStyleGenPlatform.Catalogue,
    MultiStyleGenPlatform.Billboard,
];
export const MULTI_STYLE_PLATFORM_CONFIG = {
    [MultiStyleGenPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
    [MultiStyleGenPlatform.Mobile]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [MultiStyleGenPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
    [MultiStyleGenPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
    [MultiStyleGenPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [MultiStyleGenPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
    [MultiStyleGenPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
    [MultiStyleGenPlatform.Catalogue]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
    [MultiStyleGenPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
};
export const INDUSTRY_STYLE_MAP = {
    technology: MultiStyleImageCategory.Technology,
    software: MultiStyleImageCategory.Technology,
    fashion: MultiStyleImageCategory.Fashion,
    food: MultiStyleImageCategory.FoodPhotography,
    beauty: MultiStyleImageCategory.Luxury,
    default: MultiStyleImageCategory.Commercial,
};
export const VARIATION_STYLE_MAP = {
    [MultiStyleVariationType.StyleVersionA]: MultiStyleImageCategory.Photorealistic,
    [MultiStyleVariationType.StyleVersionB]: MultiStyleImageCategory.Editorial,
    [MultiStyleVariationType.StyleVersionC]: MultiStyleImageCategory.Lifestyle,
    [MultiStyleVariationType.PremiumVersion]: MultiStyleImageCategory.Luxury,
    [MultiStyleVariationType.CommercialVersion]: MultiStyleImageCategory.Commercial,
    [MultiStyleVariationType.SocialMediaVersion]: MultiStyleImageCategory.Minimal,
    [MultiStyleVariationType.PrintVersion]: MultiStyleImageCategory.StudioPhotography,
};
//# sourceMappingURL=types.js.map