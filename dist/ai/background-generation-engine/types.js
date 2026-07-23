/**
 * KWIZERA AI STUDIO — Background Generation & Replacement Engine types (Step 9E)
 */
export var BackgroundGenPlatform;
(function (BackgroundGenPlatform) {
    BackgroundGenPlatform["Website"] = "website";
    BackgroundGenPlatform["Instagram"] = "instagram";
    BackgroundGenPlatform["Facebook"] = "facebook";
    BackgroundGenPlatform["TikTok"] = "tiktok";
    BackgroundGenPlatform["LinkedIn"] = "linkedin";
    BackgroundGenPlatform["AmazonStyle"] = "amazon-style";
    BackgroundGenPlatform["Catalogue"] = "catalogue";
    BackgroundGenPlatform["Print"] = "print";
    BackgroundGenPlatform["Billboard"] = "billboard";
})(BackgroundGenPlatform || (BackgroundGenPlatform = {}));
export var BackgroundGenInputType;
(function (BackgroundGenInputType) {
    BackgroundGenInputType["SourceImage"] = "source-image";
    BackgroundGenInputType["ProductImage"] = "product-image";
    BackgroundGenInputType["SubjectMask"] = "subject-mask";
    BackgroundGenInputType["BackgroundPrompt"] = "background-prompt";
    BackgroundGenInputType["BrandGuidelines"] = "brand-guidelines";
    BackgroundGenInputType["Campaign"] = "campaign";
    BackgroundGenInputType["StyleReferences"] = "style-references";
    BackgroundGenInputType["KnowledgeRecord"] = "knowledge-record";
})(BackgroundGenInputType || (BackgroundGenInputType = {}));
export var BackgroundGenType;
(function (BackgroundGenType) {
    BackgroundGenType["WhiteBackground"] = "white-background";
    BackgroundGenType["TransparentBackground"] = "transparent-background";
    BackgroundGenType["StudioBackground"] = "studio-background";
    BackgroundGenType["OfficeBackground"] = "office-background";
    BackgroundGenType["HomeBackground"] = "home-background";
    BackgroundGenType["RetailStore"] = "retail-store";
    BackgroundGenType["Restaurant"] = "restaurant";
    BackgroundGenType["Nature"] = "nature";
    BackgroundGenType["City"] = "city";
    BackgroundGenType["LuxuryInterior"] = "luxury-interior";
    BackgroundGenType["AbstractBackground"] = "abstract-background";
    BackgroundGenType["CustomPromptBackground"] = "custom-prompt-background";
})(BackgroundGenType || (BackgroundGenType = {}));
export var BackgroundReplacementVariationType;
(function (BackgroundReplacementVariationType) {
    BackgroundReplacementVariationType["BackgroundVariation"] = "background-variation";
    BackgroundReplacementVariationType["BrandVariation"] = "brand-variation";
    BackgroundReplacementVariationType["SeasonalVariation"] = "seasonal-variation";
    BackgroundReplacementVariationType["CampaignVariation"] = "campaign-variation";
    BackgroundReplacementVariationType["PlatformVariation"] = "platform-variation";
})(BackgroundReplacementVariationType || (BackgroundReplacementVariationType = {}));
export var BackgroundMarketingPreset;
(function (BackgroundMarketingPreset) {
    BackgroundMarketingPreset["Ecommerce"] = "ecommerce";
    BackgroundMarketingPreset["LuxuryProducts"] = "luxury-products";
    BackgroundMarketingPreset["Fashion"] = "fashion";
    BackgroundMarketingPreset["Food"] = "food";
    BackgroundMarketingPreset["Electronics"] = "electronics";
    BackgroundMarketingPreset["RealEstate"] = "real-estate";
    BackgroundMarketingPreset["Automotive"] = "automotive";
    BackgroundMarketingPreset["Healthcare"] = "healthcare";
    BackgroundMarketingPreset["Education"] = "education";
})(BackgroundMarketingPreset || (BackgroundMarketingPreset = {}));
export var SubjectPreservationTarget;
(function (SubjectPreservationTarget) {
    SubjectPreservationTarget["HumanIdentity"] = "human-identity";
    SubjectPreservationTarget["ProductIdentity"] = "product-identity";
    SubjectPreservationTarget["Logo"] = "logo";
    SubjectPreservationTarget["Packaging"] = "packaging";
    SubjectPreservationTarget["Shape"] = "shape";
    SubjectPreservationTarget["Texture"] = "texture";
    SubjectPreservationTarget["Colors"] = "colors";
    SubjectPreservationTarget["TransparentAreas"] = "transparent-areas";
})(SubjectPreservationTarget || (SubjectPreservationTarget = {}));
export class BackgroundGenerationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "BackgroundGenerationEngineError";
    }
}
export const ALL_BACKGROUND_GEN_TYPES = [
    BackgroundGenType.WhiteBackground,
    BackgroundGenType.TransparentBackground,
    BackgroundGenType.StudioBackground,
    BackgroundGenType.OfficeBackground,
    BackgroundGenType.HomeBackground,
    BackgroundGenType.RetailStore,
    BackgroundGenType.Restaurant,
    BackgroundGenType.Nature,
    BackgroundGenType.City,
    BackgroundGenType.LuxuryInterior,
    BackgroundGenType.AbstractBackground,
    BackgroundGenType.CustomPromptBackground,
];
export const ALL_SUBJECT_PRESERVATION_TARGETS = [
    SubjectPreservationTarget.HumanIdentity,
    SubjectPreservationTarget.ProductIdentity,
    SubjectPreservationTarget.Logo,
    SubjectPreservationTarget.Packaging,
    SubjectPreservationTarget.Shape,
    SubjectPreservationTarget.Texture,
    SubjectPreservationTarget.Colors,
    SubjectPreservationTarget.TransparentAreas,
];
export const ALL_BACKGROUND_MARKETING_PRESETS = [
    BackgroundMarketingPreset.Ecommerce,
    BackgroundMarketingPreset.LuxuryProducts,
    BackgroundMarketingPreset.Fashion,
    BackgroundMarketingPreset.Food,
    BackgroundMarketingPreset.Electronics,
    BackgroundMarketingPreset.RealEstate,
    BackgroundMarketingPreset.Automotive,
    BackgroundMarketingPreset.Healthcare,
    BackgroundMarketingPreset.Education,
];
export const ALL_BACKGROUND_GEN_PLATFORMS = [
    BackgroundGenPlatform.Website,
    BackgroundGenPlatform.Instagram,
    BackgroundGenPlatform.Facebook,
    BackgroundGenPlatform.TikTok,
    BackgroundGenPlatform.LinkedIn,
    BackgroundGenPlatform.AmazonStyle,
    BackgroundGenPlatform.Catalogue,
    BackgroundGenPlatform.Print,
    BackgroundGenPlatform.Billboard,
];
export const PLATFORM_CONFIG = {
    [BackgroundGenPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
    [BackgroundGenPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
    [BackgroundGenPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
    [BackgroundGenPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [BackgroundGenPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
    [BackgroundGenPlatform.AmazonStyle]: { aspectRatio: "1:1", resolution: "2000x2000", width: 2000, height: 2000 },
    [BackgroundGenPlatform.Catalogue]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
    [BackgroundGenPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
    [BackgroundGenPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
};
//# sourceMappingURL=types.js.map