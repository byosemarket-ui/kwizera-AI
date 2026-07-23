/**
 * KWIZERA AI STUDIO — Product Image Generation Engine types (Step 9D)
 */
export var ProductImageGenPlatform;
(function (ProductImageGenPlatform) {
    ProductImageGenPlatform["Website"] = "website";
    ProductImageGenPlatform["Instagram"] = "instagram";
    ProductImageGenPlatform["Facebook"] = "facebook";
    ProductImageGenPlatform["TikTok"] = "tiktok";
    ProductImageGenPlatform["LinkedIn"] = "linkedin";
    ProductImageGenPlatform["Ecommerce"] = "ecommerce";
    ProductImageGenPlatform["Print"] = "print";
    ProductImageGenPlatform["Billboard"] = "billboard";
})(ProductImageGenPlatform || (ProductImageGenPlatform = {}));
export var ProductImageGenInputType;
(function (ProductImageGenInputType) {
    ProductImageGenInputType["ProductInformation"] = "product-information";
    ProductImageGenInputType["ProductImages"] = "product-images";
    ProductImageGenInputType["BrandGuidelines"] = "brand-guidelines";
    ProductImageGenInputType["Campaign"] = "campaign";
    ProductImageGenInputType["StyleReferences"] = "style-references";
    ProductImageGenInputType["KnowledgeRecord"] = "knowledge-record";
})(ProductImageGenInputType || (ProductImageGenInputType = {}));
export var ProductPresentationView;
(function (ProductPresentationView) {
    ProductPresentationView["HeroImage"] = "hero-image";
    ProductPresentationView["FrontView"] = "front-view";
    ProductPresentationView["BackView"] = "back-view";
    ProductPresentationView["LeftView"] = "left-view";
    ProductPresentationView["RightView"] = "right-view";
    ProductPresentationView["TopView"] = "top-view";
    ProductPresentationView["BottomView"] = "bottom-view";
    ProductPresentationView["ThreeSixtyPlanning"] = "360-planning";
    ProductPresentationView["DetailCloseUp"] = "detail-close-up";
    ProductPresentationView["LifestylePresentation"] = "lifestyle-presentation";
})(ProductPresentationView || (ProductPresentationView = {}));
export var ProductPhotographyMode;
(function (ProductPhotographyMode) {
    ProductPhotographyMode["StudioPhotography"] = "studio-photography";
    ProductPhotographyMode["LifestylePhotography"] = "lifestyle-photography";
    ProductPhotographyMode["CommercialPhotography"] = "commercial-photography";
    ProductPhotographyMode["LuxuryPhotography"] = "luxury-photography";
    ProductPhotographyMode["WhiteBackground"] = "white-background";
    ProductPhotographyMode["TransparentBackground"] = "transparent-background";
    ProductPhotographyMode["CreativeBackground"] = "creative-background";
})(ProductPhotographyMode || (ProductPhotographyMode = {}));
export var ProductImageBackgroundType;
(function (ProductImageBackgroundType) {
    ProductImageBackgroundType["WhiteBackground"] = "white-background";
    ProductImageBackgroundType["TransparentBackground"] = "transparent-background";
    ProductImageBackgroundType["StudioSetup"] = "studio-setup";
    ProductImageBackgroundType["HomeEnvironment"] = "home-environment";
    ProductImageBackgroundType["OfficeEnvironment"] = "office-environment";
    ProductImageBackgroundType["OutdoorEnvironment"] = "outdoor-environment";
    ProductImageBackgroundType["PremiumEnvironment"] = "premium-environment";
})(ProductImageBackgroundType || (ProductImageBackgroundType = {}));
export var ProductLightingType;
(function (ProductLightingType) {
    ProductLightingType["StudioLighting"] = "studio-lighting";
    ProductLightingType["NaturalLighting"] = "natural-lighting";
    ProductLightingType["SoftboxLighting"] = "softbox-lighting";
    ProductLightingType["RimLighting"] = "rim-lighting";
    ProductLightingType["ProductHighlight"] = "product-highlight";
    ProductLightingType["ReflectionControl"] = "reflection-control";
    ProductLightingType["ShadowPlanning"] = "shadow-planning";
})(ProductLightingType || (ProductLightingType = {}));
export var ProductConsistencyRule;
(function (ProductConsistencyRule) {
    ProductConsistencyRule["ProductShape"] = "product-shape";
    ProductConsistencyRule["ProductColor"] = "product-color";
    ProductConsistencyRule["ProductSize"] = "product-size";
    ProductConsistencyRule["ProductTexture"] = "product-texture";
    ProductConsistencyRule["LogoPlacement"] = "logo-placement";
    ProductConsistencyRule["PackagingConsistency"] = "packaging-consistency";
})(ProductConsistencyRule || (ProductConsistencyRule = {}));
export var ProductMarketingVariation;
(function (ProductMarketingVariation) {
    ProductMarketingVariation["SocialMedia"] = "social-media";
    ProductMarketingVariation["Ecommerce"] = "ecommerce";
    ProductMarketingVariation["Website"] = "website";
    ProductMarketingVariation["Catalogue"] = "catalogue";
    ProductMarketingVariation["Billboard"] = "billboard";
    ProductMarketingVariation["Print"] = "print";
})(ProductMarketingVariation || (ProductMarketingVariation = {}));
export class ProductImageGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ProductImageGenerationEngineError";
    }
}
export const ALL_PRODUCT_PRESENTATION_VIEWS = [
    ProductPresentationView.HeroImage,
    ProductPresentationView.FrontView,
    ProductPresentationView.BackView,
    ProductPresentationView.LeftView,
    ProductPresentationView.RightView,
    ProductPresentationView.TopView,
    ProductPresentationView.BottomView,
    ProductPresentationView.ThreeSixtyPlanning,
    ProductPresentationView.DetailCloseUp,
    ProductPresentationView.LifestylePresentation,
];
export const ALL_PRODUCT_PHOTOGRAPHY_MODES = [
    ProductPhotographyMode.StudioPhotography,
    ProductPhotographyMode.LifestylePhotography,
    ProductPhotographyMode.CommercialPhotography,
    ProductPhotographyMode.LuxuryPhotography,
    ProductPhotographyMode.WhiteBackground,
    ProductPhotographyMode.TransparentBackground,
    ProductPhotographyMode.CreativeBackground,
];
export const ALL_PRODUCT_CONSISTENCY_RULES = [
    ProductConsistencyRule.ProductShape,
    ProductConsistencyRule.ProductColor,
    ProductConsistencyRule.ProductSize,
    ProductConsistencyRule.ProductTexture,
    ProductConsistencyRule.LogoPlacement,
    ProductConsistencyRule.PackagingConsistency,
];
export const ALL_PRODUCT_MARKETING_VARIATIONS = [
    ProductMarketingVariation.SocialMedia,
    ProductMarketingVariation.Ecommerce,
    ProductMarketingVariation.Website,
    ProductMarketingVariation.Catalogue,
    ProductMarketingVariation.Billboard,
    ProductMarketingVariation.Print,
];
export const ALL_PRODUCT_IMAGE_GEN_PLATFORMS = [
    ProductImageGenPlatform.Website,
    ProductImageGenPlatform.Instagram,
    ProductImageGenPlatform.Facebook,
    ProductImageGenPlatform.TikTok,
    ProductImageGenPlatform.LinkedIn,
    ProductImageGenPlatform.Ecommerce,
    ProductImageGenPlatform.Print,
    ProductImageGenPlatform.Billboard,
];
export const PLATFORM_CONFIG = {
    [ProductImageGenPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
    [ProductImageGenPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
    [ProductImageGenPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
    [ProductImageGenPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [ProductImageGenPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
    [ProductImageGenPlatform.Ecommerce]: { aspectRatio: "1:1", resolution: "2000x2000", width: 2000, height: 2000 },
    [ProductImageGenPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
    [ProductImageGenPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
};
//# sourceMappingURL=types.js.map