/**
 * KWIZERA AI STUDIO — Image Rendering Preparation Engine types (Step 9K)
 */
export var ImageRenderPlatform;
(function (ImageRenderPlatform) {
    ImageRenderPlatform["Website"] = "website";
    ImageRenderPlatform["Mobile"] = "mobile";
    ImageRenderPlatform["Instagram"] = "instagram";
    ImageRenderPlatform["Facebook"] = "facebook";
    ImageRenderPlatform["TikTok"] = "tiktok";
    ImageRenderPlatform["LinkedIn"] = "linkedin";
    ImageRenderPlatform["Print"] = "print";
    ImageRenderPlatform["Packaging"] = "packaging";
    ImageRenderPlatform["Catalogue"] = "catalogue";
    ImageRenderPlatform["Billboard"] = "billboard";
})(ImageRenderPlatform || (ImageRenderPlatform = {}));
export var ImageRenderValidationStage;
(function (ImageRenderValidationStage) {
    ImageRenderValidationStage["TextToImage"] = "text-to-image";
    ImageRenderValidationStage["ImageToImage"] = "image-to-image";
    ImageRenderValidationStage["ProductImageGeneration"] = "product-image-generation";
    ImageRenderValidationStage["BackgroundGeneration"] = "background-generation";
    ImageRenderValidationStage["ImageEditing"] = "image-editing";
    ImageRenderValidationStage["ImageEnhancement"] = "image-enhancement";
    ImageRenderValidationStage["Branding"] = "branding";
    ImageRenderValidationStage["MultiStyleGeneration"] = "multi-style-generation";
    ImageRenderValidationStage["ProductionPlans"] = "production-plans";
})(ImageRenderValidationStage || (ImageRenderValidationStage = {}));
export var ImageRenderLayerCheck;
(function (ImageRenderLayerCheck) {
    ImageRenderLayerCheck["LayerHierarchy"] = "layer-hierarchy";
    ImageRenderLayerCheck["LayerOrder"] = "layer-order";
    ImageRenderLayerCheck["LayerVisibility"] = "layer-visibility";
    ImageRenderLayerCheck["LayerGroups"] = "layer-groups";
    ImageRenderLayerCheck["BlendModes"] = "blend-modes";
    ImageRenderLayerCheck["Opacity"] = "opacity";
    ImageRenderLayerCheck["ClippingMasks"] = "clipping-masks";
})(ImageRenderLayerCheck || (ImageRenderLayerCheck = {}));
export var ImageRenderMaskType;
(function (ImageRenderMaskType) {
    ImageRenderMaskType["SubjectMask"] = "subject-mask";
    ImageRenderMaskType["ObjectMask"] = "object-mask";
    ImageRenderMaskType["BackgroundMask"] = "background-mask";
    ImageRenderMaskType["LayerMask"] = "layer-mask";
    ImageRenderMaskType["AlphaMask"] = "alpha-mask";
    ImageRenderMaskType["EditableRegion"] = "editable-region";
})(ImageRenderMaskType || (ImageRenderMaskType = {}));
export var ImageRenderAssetType;
(function (ImageRenderAssetType) {
    ImageRenderAssetType["SourceImage"] = "source-image";
    ImageRenderAssetType["GeneratedImage"] = "generated-image";
    ImageRenderAssetType["Logo"] = "logo";
    ImageRenderAssetType["Font"] = "font";
    ImageRenderAssetType["Icon"] = "icon";
    ImageRenderAssetType["Template"] = "template";
    ImageRenderAssetType["Texture"] = "texture";
    ImageRenderAssetType["BrandAsset"] = "brand-asset";
    ImageRenderAssetType["IccProfile"] = "icc-profile";
    ImageRenderAssetType["Metadata"] = "metadata";
})(ImageRenderAssetType || (ImageRenderAssetType = {}));
export var ImageRenderColorSpace;
(function (ImageRenderColorSpace) {
    ImageRenderColorSpace["Rgb"] = "rgb";
    ImageRenderColorSpace["Cmyk"] = "cmyk";
})(ImageRenderColorSpace || (ImageRenderColorSpace = {}));
export class ImageRenderEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageRenderEngineError";
    }
}
export const ALL_IMAGE_RENDER_PLATFORMS = [
    ImageRenderPlatform.Website,
    ImageRenderPlatform.Mobile,
    ImageRenderPlatform.Instagram,
    ImageRenderPlatform.Facebook,
    ImageRenderPlatform.TikTok,
    ImageRenderPlatform.LinkedIn,
    ImageRenderPlatform.Print,
    ImageRenderPlatform.Packaging,
    ImageRenderPlatform.Catalogue,
    ImageRenderPlatform.Billboard,
];
export const ALL_IMAGE_RENDER_VALIDATION_STAGES = [
    ImageRenderValidationStage.TextToImage,
    ImageRenderValidationStage.ImageToImage,
    ImageRenderValidationStage.ProductImageGeneration,
    ImageRenderValidationStage.BackgroundGeneration,
    ImageRenderValidationStage.ImageEditing,
    ImageRenderValidationStage.ImageEnhancement,
    ImageRenderValidationStage.Branding,
    ImageRenderValidationStage.MultiStyleGeneration,
    ImageRenderValidationStage.ProductionPlans,
];
export const ALL_IMAGE_RENDER_LAYER_CHECKS = [
    ImageRenderLayerCheck.LayerHierarchy,
    ImageRenderLayerCheck.LayerOrder,
    ImageRenderLayerCheck.LayerVisibility,
    ImageRenderLayerCheck.LayerGroups,
    ImageRenderLayerCheck.BlendModes,
    ImageRenderLayerCheck.Opacity,
    ImageRenderLayerCheck.ClippingMasks,
];
export const ALL_IMAGE_RENDER_MASK_TYPES = [
    ImageRenderMaskType.SubjectMask,
    ImageRenderMaskType.ObjectMask,
    ImageRenderMaskType.BackgroundMask,
    ImageRenderMaskType.LayerMask,
    ImageRenderMaskType.AlphaMask,
    ImageRenderMaskType.EditableRegion,
];
export const ALL_IMAGE_RENDER_ASSET_TYPES = [
    ImageRenderAssetType.SourceImage,
    ImageRenderAssetType.GeneratedImage,
    ImageRenderAssetType.Logo,
    ImageRenderAssetType.Font,
    ImageRenderAssetType.Icon,
    ImageRenderAssetType.Template,
    ImageRenderAssetType.Texture,
    ImageRenderAssetType.BrandAsset,
    ImageRenderAssetType.IccProfile,
    ImageRenderAssetType.Metadata,
];
export const IMAGE_RENDER_PLATFORM_CONFIG = {
    [ImageRenderPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080, dpi: 72 },
    [ImageRenderPlatform.Mobile]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920, dpi: 72 },
    [ImageRenderPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080, dpi: 72 },
    [ImageRenderPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628, dpi: 72 },
    [ImageRenderPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920, dpi: 72 },
    [ImageRenderPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627, dpi: 72 },
    [ImageRenderPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000, dpi: 300 },
    [ImageRenderPlatform.Packaging]: { aspectRatio: "1:1", resolution: "2048x2048", width: 2048, height: 2048, dpi: 300 },
    [ImageRenderPlatform.Catalogue]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000, dpi: 300 },
    [ImageRenderPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000, dpi: 150 },
};
export const RENDER_VALIDATION_MODULE_MAP = {
    [ImageRenderValidationStage.TextToImage]: "text-to-image-generation-engine",
    [ImageRenderValidationStage.ImageToImage]: "image-to-image-generation-engine",
    [ImageRenderValidationStage.ProductImageGeneration]: "product-image-generation-engine",
    [ImageRenderValidationStage.BackgroundGeneration]: "background-generation-engine",
    [ImageRenderValidationStage.ImageEditing]: "image-editing-generation-engine",
    [ImageRenderValidationStage.ImageEnhancement]: "image-enhancement-generation-engine",
    [ImageRenderValidationStage.Branding]: "branding-design-generation-engine",
    [ImageRenderValidationStage.MultiStyleGeneration]: "multi-style-image-generation-engine",
    [ImageRenderValidationStage.ProductionPlans]: "image-production-engine",
};
//# sourceMappingURL=types.js.map