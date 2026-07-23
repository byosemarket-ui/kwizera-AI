/**
 * KWIZERA AI STUDIO — Image Quality Validation Engine types (Step 9L)
 */
export var QualityValidationPlatform;
(function (QualityValidationPlatform) {
    QualityValidationPlatform["Website"] = "website";
    QualityValidationPlatform["Mobile"] = "mobile";
    QualityValidationPlatform["Instagram"] = "instagram";
    QualityValidationPlatform["Facebook"] = "facebook";
    QualityValidationPlatform["TikTok"] = "tiktok";
    QualityValidationPlatform["LinkedIn"] = "linkedin";
    QualityValidationPlatform["Print"] = "print";
    QualityValidationPlatform["Packaging"] = "packaging";
    QualityValidationPlatform["Billboard"] = "billboard";
})(QualityValidationPlatform || (QualityValidationPlatform = {}));
export var ImageQualityCheck;
(function (ImageQualityCheck) {
    ImageQualityCheck["ImageResolution"] = "image-resolution";
    ImageQualityCheck["Sharpness"] = "sharpness";
    ImageQualityCheck["Noise"] = "noise";
    ImageQualityCheck["CompressionArtifacts"] = "compression-artifacts";
    ImageQualityCheck["ColorAccuracy"] = "color-accuracy";
    ImageQualityCheck["WhiteBalance"] = "white-balance";
    ImageQualityCheck["Exposure"] = "exposure";
    ImageQualityCheck["Contrast"] = "contrast";
    ImageQualityCheck["DynamicRange"] = "dynamic-range";
    ImageQualityCheck["TextureQuality"] = "texture-quality";
})(ImageQualityCheck || (ImageQualityCheck = {}));
export var QualityLayerCheck;
(function (QualityLayerCheck) {
    QualityLayerCheck["LayerStructure"] = "layer-structure";
    QualityLayerCheck["LayerOrder"] = "layer-order";
    QualityLayerCheck["LayerGroups"] = "layer-groups";
    QualityLayerCheck["BlendModes"] = "blend-modes";
    QualityLayerCheck["Opacity"] = "opacity";
    QualityLayerCheck["ClippingMasks"] = "clipping-masks";
})(QualityLayerCheck || (QualityLayerCheck = {}));
export var QualityMaskType;
(function (QualityMaskType) {
    QualityMaskType["SubjectMask"] = "subject-mask";
    QualityMaskType["ObjectMask"] = "object-mask";
    QualityMaskType["BackgroundMask"] = "background-mask";
    QualityMaskType["LayerMask"] = "layer-mask";
    QualityMaskType["AlphaMask"] = "alpha-mask";
    QualityMaskType["EditableRegion"] = "editable-region";
})(QualityMaskType || (QualityMaskType = {}));
export var TypographyCheck;
(function (TypographyCheck) {
    TypographyCheck["FontUsage"] = "font-usage";
    TypographyCheck["FontConsistency"] = "font-consistency";
    TypographyCheck["TypographyHierarchy"] = "typography-hierarchy";
    TypographyCheck["Spacing"] = "spacing";
    TypographyCheck["Alignment"] = "alignment";
    TypographyCheck["Readability"] = "readability";
    TypographyCheck["Spelling"] = "spelling";
})(TypographyCheck || (TypographyCheck = {}));
export var BrandValidationCheck;
(function (BrandValidationCheck) {
    BrandValidationCheck["LogoUsage"] = "logo-usage";
    BrandValidationCheck["BrandColors"] = "brand-colors";
    BrandValidationCheck["Typography"] = "typography";
    BrandValidationCheck["BrandAssets"] = "brand-assets";
    BrandValidationCheck["DesignConsistency"] = "design-consistency";
    BrandValidationCheck["CampaignConsistency"] = "campaign-consistency";
})(BrandValidationCheck || (BrandValidationCheck = {}));
export var PrintValidationCheck;
(function (PrintValidationCheck) {
    PrintValidationCheck["Dpi"] = "dpi";
    PrintValidationCheck["Resolution"] = "resolution";
    PrintValidationCheck["Cmyk"] = "cmyk";
    PrintValidationCheck["Rgb"] = "rgb";
    PrintValidationCheck["IccProfiles"] = "icc-profiles";
    PrintValidationCheck["BleedPreparation"] = "bleed-preparation";
    PrintValidationCheck["SafeMargins"] = "safe-margins";
    PrintValidationCheck["CropMarks"] = "crop-marks";
})(PrintValidationCheck || (PrintValidationCheck = {}));
export var TechnicalValidationCheck;
(function (TechnicalValidationCheck) {
    TechnicalValidationCheck["FileFormat"] = "file-format";
    TechnicalValidationCheck["ColorSpace"] = "color-space";
    TechnicalValidationCheck["BitDepth"] = "bit-depth";
    TechnicalValidationCheck["Transparency"] = "transparency";
    TechnicalValidationCheck["Metadata"] = "metadata";
    TechnicalValidationCheck["Compression"] = "compression";
    TechnicalValidationCheck["AlphaChannel"] = "alpha-channel";
})(TechnicalValidationCheck || (TechnicalValidationCheck = {}));
export var QualityIssueSeverity;
(function (QualityIssueSeverity) {
    QualityIssueSeverity["Low"] = "low";
    QualityIssueSeverity["Medium"] = "medium";
    QualityIssueSeverity["High"] = "high";
    QualityIssueSeverity["Critical"] = "critical";
})(QualityIssueSeverity || (QualityIssueSeverity = {}));
export var QualityIssueCategory;
(function (QualityIssueCategory) {
    QualityIssueCategory["MissingAsset"] = "missing-asset";
    QualityIssueCategory["BrokenLayer"] = "broken-layer";
    QualityIssueCategory["BrokenMask"] = "broken-mask";
    QualityIssueCategory["Typography"] = "typography";
    QualityIssueCategory["Color"] = "color";
    QualityIssueCategory["Branding"] = "branding";
    QualityIssueCategory["RenderingRisk"] = "rendering-risk";
})(QualityIssueCategory || (QualityIssueCategory = {}));
export class ImageQualityValidationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageQualityValidationEngineError";
    }
}
export const ALL_QUALITY_VALIDATION_PLATFORMS = [
    QualityValidationPlatform.Website,
    QualityValidationPlatform.Mobile,
    QualityValidationPlatform.Instagram,
    QualityValidationPlatform.Facebook,
    QualityValidationPlatform.TikTok,
    QualityValidationPlatform.LinkedIn,
    QualityValidationPlatform.Print,
    QualityValidationPlatform.Packaging,
    QualityValidationPlatform.Billboard,
];
export const ALL_IMAGE_QUALITY_CHECKS = [
    ImageQualityCheck.ImageResolution,
    ImageQualityCheck.Sharpness,
    ImageQualityCheck.Noise,
    ImageQualityCheck.CompressionArtifacts,
    ImageQualityCheck.ColorAccuracy,
    ImageQualityCheck.WhiteBalance,
    ImageQualityCheck.Exposure,
    ImageQualityCheck.Contrast,
    ImageQualityCheck.DynamicRange,
    ImageQualityCheck.TextureQuality,
];
export const ALL_QUALITY_LAYER_CHECKS = [
    QualityLayerCheck.LayerStructure,
    QualityLayerCheck.LayerOrder,
    QualityLayerCheck.LayerGroups,
    QualityLayerCheck.BlendModes,
    QualityLayerCheck.Opacity,
    QualityLayerCheck.ClippingMasks,
];
export const ALL_QUALITY_MASK_TYPES = [
    QualityMaskType.SubjectMask,
    QualityMaskType.ObjectMask,
    QualityMaskType.BackgroundMask,
    QualityMaskType.LayerMask,
    QualityMaskType.AlphaMask,
    QualityMaskType.EditableRegion,
];
export const ALL_TYPOGRAPHY_CHECKS = [
    TypographyCheck.FontUsage,
    TypographyCheck.FontConsistency,
    TypographyCheck.TypographyHierarchy,
    TypographyCheck.Spacing,
    TypographyCheck.Alignment,
    TypographyCheck.Readability,
    TypographyCheck.Spelling,
];
export const ALL_BRAND_VALIDATION_CHECKS = [
    BrandValidationCheck.LogoUsage,
    BrandValidationCheck.BrandColors,
    BrandValidationCheck.Typography,
    BrandValidationCheck.BrandAssets,
    BrandValidationCheck.DesignConsistency,
    BrandValidationCheck.CampaignConsistency,
];
export const ALL_PRINT_VALIDATION_CHECKS = [
    PrintValidationCheck.Dpi,
    PrintValidationCheck.Resolution,
    PrintValidationCheck.Cmyk,
    PrintValidationCheck.Rgb,
    PrintValidationCheck.IccProfiles,
    PrintValidationCheck.BleedPreparation,
    PrintValidationCheck.SafeMargins,
    PrintValidationCheck.CropMarks,
];
export const ALL_TECHNICAL_VALIDATION_CHECKS = [
    TechnicalValidationCheck.FileFormat,
    TechnicalValidationCheck.ColorSpace,
    TechnicalValidationCheck.BitDepth,
    TechnicalValidationCheck.Transparency,
    TechnicalValidationCheck.Metadata,
    TechnicalValidationCheck.Compression,
    TechnicalValidationCheck.AlphaChannel,
];
export const QUALITY_PLATFORM_CONFIG = {
    [QualityValidationPlatform.Website]: { resolution: "1920x1080", dpi: 72, aspectRatio: "16:9" },
    [QualityValidationPlatform.Mobile]: { resolution: "1080x1920", dpi: 72, aspectRatio: "9:16" },
    [QualityValidationPlatform.Instagram]: { resolution: "1080x1080", dpi: 72, aspectRatio: "1:1" },
    [QualityValidationPlatform.Facebook]: { resolution: "1200x628", dpi: 72, aspectRatio: "1.91:1" },
    [QualityValidationPlatform.TikTok]: { resolution: "1080x1920", dpi: 72, aspectRatio: "9:16" },
    [QualityValidationPlatform.LinkedIn]: { resolution: "1200x627", dpi: 72, aspectRatio: "1.91:1" },
    [QualityValidationPlatform.Print]: { resolution: "3000x2000", dpi: 300, aspectRatio: "3:2" },
    [QualityValidationPlatform.Packaging]: { resolution: "2048x2048", dpi: 300, aspectRatio: "1:1" },
    [QualityValidationPlatform.Billboard]: { resolution: "6000x2000", dpi: 150, aspectRatio: "3:1" },
};
//# sourceMappingURL=types.js.map