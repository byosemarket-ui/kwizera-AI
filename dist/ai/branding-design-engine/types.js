/**
 * KWIZERA AI STUDIO — Branding & Graphic Design Engine types (Step 9H)
 */
export var BrandDesignGenPlatform;
(function (BrandDesignGenPlatform) {
    BrandDesignGenPlatform["Website"] = "website";
    BrandDesignGenPlatform["Mobile"] = "mobile";
    BrandDesignGenPlatform["Instagram"] = "instagram";
    BrandDesignGenPlatform["Facebook"] = "facebook";
    BrandDesignGenPlatform["LinkedIn"] = "linkedin";
    BrandDesignGenPlatform["TikTok"] = "tiktok";
    BrandDesignGenPlatform["YouTube"] = "youtube";
    BrandDesignGenPlatform["Print"] = "print";
    BrandDesignGenPlatform["Catalogue"] = "catalogue";
    BrandDesignGenPlatform["Billboard"] = "billboard";
})(BrandDesignGenPlatform || (BrandDesignGenPlatform = {}));
export var BrandDesignGenInputType;
(function (BrandDesignGenInputType) {
    BrandDesignGenInputType["BrandGuidelines"] = "brand-guidelines";
    BrandDesignGenInputType["Product"] = "product";
    BrandDesignGenInputType["Campaign"] = "campaign";
    BrandDesignGenInputType["MarketingObjective"] = "marketing-objective";
    BrandDesignGenInputType["Prompt"] = "prompt";
    BrandDesignGenInputType["Image"] = "image";
    BrandDesignGenInputType["Logo"] = "logo";
    BrandDesignGenInputType["Font"] = "font";
    BrandDesignGenInputType["Icon"] = "icon";
    BrandDesignGenInputType["ColorPalette"] = "color-palette";
    BrandDesignGenInputType["Template"] = "template";
    BrandDesignGenInputType["KnowledgeRecord"] = "knowledge-record";
})(BrandDesignGenInputType || (BrandDesignGenInputType = {}));
export var BrandDesignType;
(function (BrandDesignType) {
    BrandDesignType["BrandingPlan"] = "branding-plan";
    BrandDesignType["LogoDesign"] = "logo-design";
    BrandDesignType["PosterLayout"] = "poster-layout";
    BrandDesignType["FlyerLayout"] = "flyer-layout";
    BrandDesignType["BannerLayout"] = "banner-layout";
    BrandDesignType["BusinessCardLayout"] = "business-card-layout";
    BrandDesignType["BrochureLayout"] = "brochure-layout";
    BrandDesignType["PackagingLayout"] = "packaging-layout";
    BrandDesignType["SocialMediaGraphic"] = "social-media-graphic";
    BrandDesignType["ThumbnailLayout"] = "thumbnail-layout";
    BrandDesignType["PresentationGraphic"] = "presentation-graphic";
})(BrandDesignType || (BrandDesignType = {}));
export var BrandDesignMaterialType;
(function (BrandDesignMaterialType) {
    BrandDesignMaterialType["Poster"] = "poster";
    BrandDesignMaterialType["Flyer"] = "flyer";
    BrandDesignMaterialType["Brochure"] = "brochure";
    BrandDesignMaterialType["RollUpBanner"] = "roll-up-banner";
    BrandDesignMaterialType["Billboard"] = "billboard";
    BrandDesignMaterialType["SocialMediaPost"] = "social-media-post";
    BrandDesignMaterialType["Story"] = "story";
    BrandDesignMaterialType["Cover"] = "cover";
    BrandDesignMaterialType["BusinessCard"] = "business-card";
    BrandDesignMaterialType["Letterhead"] = "letterhead";
    BrandDesignMaterialType["Envelope"] = "envelope";
    BrandDesignMaterialType["Packaging"] = "packaging";
})(BrandDesignMaterialType || (BrandDesignMaterialType = {}));
export var BrandDesignSocialFormat;
(function (BrandDesignSocialFormat) {
    BrandDesignSocialFormat["InstagramPost"] = "instagram-post";
    BrandDesignSocialFormat["InstagramStory"] = "instagram-story";
    BrandDesignSocialFormat["FacebookPost"] = "facebook-post";
    BrandDesignSocialFormat["FacebookCover"] = "facebook-cover";
    BrandDesignSocialFormat["LinkedInPost"] = "linkedin-post";
    BrandDesignSocialFormat["LinkedInBanner"] = "linkedin-banner";
    BrandDesignSocialFormat["TikTokCover"] = "tiktok-cover";
    BrandDesignSocialFormat["YouTubeThumbnail"] = "youtube-thumbnail";
    BrandDesignSocialFormat["YouTubeBanner"] = "youtube-banner";
})(BrandDesignSocialFormat || (BrandDesignSocialFormat = {}));
export var BrandDesignPrintFormat;
(function (BrandDesignPrintFormat) {
    BrandDesignPrintFormat["A4"] = "a4";
    BrandDesignPrintFormat["A5"] = "a5";
    BrandDesignPrintFormat["A3"] = "a3";
    BrandDesignPrintFormat["BusinessCard"] = "business-card";
    BrandDesignPrintFormat["RollUpBanner"] = "roll-up-banner";
    BrandDesignPrintFormat["Billboard"] = "billboard";
    BrandDesignPrintFormat["Packaging"] = "packaging";
    BrandDesignPrintFormat["Sticker"] = "sticker";
    BrandDesignPrintFormat["Label"] = "label";
})(BrandDesignPrintFormat || (BrandDesignPrintFormat = {}));
export var BrandDesignLogoVariant;
(function (BrandDesignLogoVariant) {
    BrandDesignLogoVariant["PrimaryLogo"] = "primary-logo";
    BrandDesignLogoVariant["SecondaryLogo"] = "secondary-logo";
    BrandDesignLogoVariant["IconVersion"] = "icon-version";
    BrandDesignLogoVariant["MonochromeVersion"] = "monochrome-version";
    BrandDesignLogoVariant["LightBackgroundVersion"] = "light-background-version";
    BrandDesignLogoVariant["DarkBackgroundVersion"] = "dark-background-version";
})(BrandDesignLogoVariant || (BrandDesignLogoVariant = {}));
export var BrandDesignConsistencyElement;
(function (BrandDesignConsistencyElement) {
    BrandDesignConsistencyElement["LogoUsage"] = "logo-usage";
    BrandDesignConsistencyElement["Typography"] = "typography";
    BrandDesignConsistencyElement["ColorPalette"] = "color-palette";
    BrandDesignConsistencyElement["BrandStyle"] = "brand-style";
    BrandDesignConsistencyElement["BrandVoice"] = "brand-voice";
    BrandDesignConsistencyElement["VisualIdentity"] = "visual-identity";
})(BrandDesignConsistencyElement || (BrandDesignConsistencyElement = {}));
export class BrandingDesignEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "BrandingDesignEngineError";
    }
}
export const ALL_BRAND_DESIGN_TYPES = [
    BrandDesignType.BrandingPlan,
    BrandDesignType.LogoDesign,
    BrandDesignType.PosterLayout,
    BrandDesignType.FlyerLayout,
    BrandDesignType.BannerLayout,
    BrandDesignType.BusinessCardLayout,
    BrandDesignType.BrochureLayout,
    BrandDesignType.PackagingLayout,
    BrandDesignType.SocialMediaGraphic,
    BrandDesignType.ThumbnailLayout,
    BrandDesignType.PresentationGraphic,
];
export const ALL_BRAND_DESIGN_MATERIALS = [
    BrandDesignMaterialType.Poster,
    BrandDesignMaterialType.Flyer,
    BrandDesignMaterialType.Brochure,
    BrandDesignMaterialType.RollUpBanner,
    BrandDesignMaterialType.Billboard,
    BrandDesignMaterialType.SocialMediaPost,
    BrandDesignMaterialType.Story,
    BrandDesignMaterialType.Cover,
    BrandDesignMaterialType.BusinessCard,
    BrandDesignMaterialType.Letterhead,
    BrandDesignMaterialType.Envelope,
    BrandDesignMaterialType.Packaging,
];
export const ALL_BRAND_DESIGN_SOCIAL_FORMATS = [
    BrandDesignSocialFormat.InstagramPost,
    BrandDesignSocialFormat.InstagramStory,
    BrandDesignSocialFormat.FacebookPost,
    BrandDesignSocialFormat.FacebookCover,
    BrandDesignSocialFormat.LinkedInPost,
    BrandDesignSocialFormat.LinkedInBanner,
    BrandDesignSocialFormat.TikTokCover,
    BrandDesignSocialFormat.YouTubeThumbnail,
    BrandDesignSocialFormat.YouTubeBanner,
];
export const ALL_BRAND_DESIGN_PRINT_FORMATS = [
    BrandDesignPrintFormat.A4,
    BrandDesignPrintFormat.A5,
    BrandDesignPrintFormat.A3,
    BrandDesignPrintFormat.BusinessCard,
    BrandDesignPrintFormat.RollUpBanner,
    BrandDesignPrintFormat.Billboard,
    BrandDesignPrintFormat.Packaging,
    BrandDesignPrintFormat.Sticker,
    BrandDesignPrintFormat.Label,
];
export const ALL_BRAND_DESIGN_LOGO_VARIANTS = [
    BrandDesignLogoVariant.PrimaryLogo,
    BrandDesignLogoVariant.SecondaryLogo,
    BrandDesignLogoVariant.IconVersion,
    BrandDesignLogoVariant.MonochromeVersion,
    BrandDesignLogoVariant.LightBackgroundVersion,
    BrandDesignLogoVariant.DarkBackgroundVersion,
];
export const ALL_BRAND_DESIGN_CONSISTENCY_ELEMENTS = [
    BrandDesignConsistencyElement.LogoUsage,
    BrandDesignConsistencyElement.Typography,
    BrandDesignConsistencyElement.ColorPalette,
    BrandDesignConsistencyElement.BrandStyle,
    BrandDesignConsistencyElement.BrandVoice,
    BrandDesignConsistencyElement.VisualIdentity,
];
export const ALL_BRAND_DESIGN_GEN_PLATFORMS = [
    BrandDesignGenPlatform.Website,
    BrandDesignGenPlatform.Mobile,
    BrandDesignGenPlatform.Instagram,
    BrandDesignGenPlatform.Facebook,
    BrandDesignGenPlatform.LinkedIn,
    BrandDesignGenPlatform.TikTok,
    BrandDesignGenPlatform.YouTube,
    BrandDesignGenPlatform.Print,
    BrandDesignGenPlatform.Catalogue,
    BrandDesignGenPlatform.Billboard,
];
export const BRAND_DESIGN_PLATFORM_CONFIG = {
    [BrandDesignGenPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080 },
    [BrandDesignGenPlatform.Mobile]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [BrandDesignGenPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080 },
    [BrandDesignGenPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628 },
    [BrandDesignGenPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627 },
    [BrandDesignGenPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920 },
    [BrandDesignGenPlatform.YouTube]: { aspectRatio: "16:9", resolution: "2560x1440", width: 2560, height: 1440 },
    [BrandDesignGenPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
    [BrandDesignGenPlatform.Catalogue]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000 },
    [BrandDesignGenPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000 },
};
export const SOCIAL_FORMAT_CONFIG = {
    [BrandDesignSocialFormat.InstagramPost]: { aspectRatio: "1:1", resolution: "1080x1080" },
    [BrandDesignSocialFormat.InstagramStory]: { aspectRatio: "9:16", resolution: "1080x1920" },
    [BrandDesignSocialFormat.FacebookPost]: { aspectRatio: "1.91:1", resolution: "1200x628" },
    [BrandDesignSocialFormat.FacebookCover]: { aspectRatio: "2.63:1", resolution: "820x312" },
    [BrandDesignSocialFormat.LinkedInPost]: { aspectRatio: "1.91:1", resolution: "1200x627" },
    [BrandDesignSocialFormat.LinkedInBanner]: { aspectRatio: "4:1", resolution: "1584x396" },
    [BrandDesignSocialFormat.TikTokCover]: { aspectRatio: "9:16", resolution: "1080x1920" },
    [BrandDesignSocialFormat.YouTubeThumbnail]: { aspectRatio: "16:9", resolution: "1280x720" },
    [BrandDesignSocialFormat.YouTubeBanner]: { aspectRatio: "16:9", resolution: "2560x1440" },
};
export const PRINT_FORMAT_CONFIG = {
    [BrandDesignPrintFormat.A4]: { dimensions: "210x297mm", bleed: "3mm" },
    [BrandDesignPrintFormat.A5]: { dimensions: "148x210mm", bleed: "3mm" },
    [BrandDesignPrintFormat.A3]: { dimensions: "297x420mm", bleed: "3mm" },
    [BrandDesignPrintFormat.BusinessCard]: { dimensions: "85x55mm", bleed: "3mm" },
    [BrandDesignPrintFormat.RollUpBanner]: { dimensions: "850x2000mm", bleed: "0mm" },
    [BrandDesignPrintFormat.Billboard]: { dimensions: "6000x2000mm", bleed: "0mm" },
    [BrandDesignPrintFormat.Packaging]: { dimensions: "custom die-line", bleed: "5mm" },
    [BrandDesignPrintFormat.Sticker]: { dimensions: "custom", bleed: "2mm" },
    [BrandDesignPrintFormat.Label]: { dimensions: "custom", bleed: "2mm" },
};
//# sourceMappingURL=types.js.map