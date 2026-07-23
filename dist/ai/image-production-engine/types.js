/**
 * KWIZERA AI STUDIO — Image Production Engine types (Step 9J)
 */
export var ImageProductionPlatform;
(function (ImageProductionPlatform) {
    ImageProductionPlatform["Website"] = "website";
    ImageProductionPlatform["Mobile"] = "mobile";
    ImageProductionPlatform["Instagram"] = "instagram";
    ImageProductionPlatform["Facebook"] = "facebook";
    ImageProductionPlatform["TikTok"] = "tiktok";
    ImageProductionPlatform["LinkedIn"] = "linkedin";
    ImageProductionPlatform["Print"] = "print";
    ImageProductionPlatform["Packaging"] = "packaging";
    ImageProductionPlatform["Billboard"] = "billboard";
})(ImageProductionPlatform || (ImageProductionPlatform = {}));
export var ImageProductionWorkflowStage;
(function (ImageProductionWorkflowStage) {
    ImageProductionWorkflowStage["TextToImage"] = "text-to-image";
    ImageProductionWorkflowStage["ImageToImage"] = "image-to-image";
    ImageProductionWorkflowStage["ProductImageGeneration"] = "product-image-generation";
    ImageProductionWorkflowStage["BackgroundGeneration"] = "background-generation";
    ImageProductionWorkflowStage["ImageEditing"] = "image-editing";
    ImageProductionWorkflowStage["ImageEnhancement"] = "image-enhancement";
    ImageProductionWorkflowStage["Branding"] = "branding";
    ImageProductionWorkflowStage["MultiStyleGeneration"] = "multi-style-generation";
    ImageProductionWorkflowStage["ProductionWorkflow"] = "production-workflow";
})(ImageProductionWorkflowStage || (ImageProductionWorkflowStage = {}));
export var ImageProductionAssetType;
(function (ImageProductionAssetType) {
    ImageProductionAssetType["SourceImage"] = "source-image";
    ImageProductionAssetType["GeneratedImage"] = "generated-image";
    ImageProductionAssetType["Logo"] = "logo";
    ImageProductionAssetType["Font"] = "font";
    ImageProductionAssetType["Icon"] = "icon";
    ImageProductionAssetType["Template"] = "template";
    ImageProductionAssetType["Layer"] = "layer";
    ImageProductionAssetType["Mask"] = "mask";
    ImageProductionAssetType["Texture"] = "texture";
    ImageProductionAssetType["BrandAsset"] = "brand-asset";
    ImageProductionAssetType["ColorProfile"] = "color-profile";
    ImageProductionAssetType["Metadata"] = "metadata";
})(ImageProductionAssetType || (ImageProductionAssetType = {}));
export var ImageProductionDependency;
(function (ImageProductionDependency) {
    ImageProductionDependency["MemoryEngine"] = "memory-engine";
    ImageProductionDependency["KnowledgeEngine"] = "knowledge-engine";
    ImageProductionDependency["ProductIntelligenceEngine"] = "product-intelligence-engine";
    ImageProductionDependency["ImageIntelligenceEngine"] = "image-intelligence-engine";
    ImageProductionDependency["VideoIntelligenceEngine"] = "video-intelligence-engine";
    ImageProductionDependency["ImageGenerationFoundation"] = "image-generation-foundation";
    ImageProductionDependency["TextToImageEngine"] = "text-to-image-generation-engine";
    ImageProductionDependency["ImageToImageEngine"] = "image-to-image-generation-engine";
    ImageProductionDependency["ProductImageEngine"] = "product-image-generation-engine";
    ImageProductionDependency["BackgroundEngine"] = "background-generation-engine";
    ImageProductionDependency["ImageEditingEngine"] = "image-editing-generation-engine";
    ImageProductionDependency["EnhancementEngine"] = "image-enhancement-generation-engine";
    ImageProductionDependency["BrandingEngine"] = "branding-design-generation-engine";
    ImageProductionDependency["MultiStyleEngine"] = "multi-style-image-generation-engine";
})(ImageProductionDependency || (ImageProductionDependency = {}));
export var ImageProductionExportFormat;
(function (ImageProductionExportFormat) {
    ImageProductionExportFormat["Png"] = "png";
    ImageProductionExportFormat["Jpg"] = "jpg";
    ImageProductionExportFormat["Webp"] = "webp";
    ImageProductionExportFormat["Tiff"] = "tiff";
    ImageProductionExportFormat["Svg"] = "svg";
    ImageProductionExportFormat["Pdf"] = "pdf";
})(ImageProductionExportFormat || (ImageProductionExportFormat = {}));
export var ImageProductionColorSpace;
(function (ImageProductionColorSpace) {
    ImageProductionColorSpace["Rgb"] = "rgb";
    ImageProductionColorSpace["Cmyk"] = "cmyk";
})(ImageProductionColorSpace || (ImageProductionColorSpace = {}));
export class ImageProductionEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageProductionEngineError";
    }
}
export const ALL_IMAGE_PRODUCTION_PLATFORMS = [
    ImageProductionPlatform.Website,
    ImageProductionPlatform.Mobile,
    ImageProductionPlatform.Instagram,
    ImageProductionPlatform.Facebook,
    ImageProductionPlatform.TikTok,
    ImageProductionPlatform.LinkedIn,
    ImageProductionPlatform.Print,
    ImageProductionPlatform.Packaging,
    ImageProductionPlatform.Billboard,
];
export const ALL_IMAGE_PRODUCTION_WORKFLOW_STAGES = [
    ImageProductionWorkflowStage.TextToImage,
    ImageProductionWorkflowStage.ImageToImage,
    ImageProductionWorkflowStage.ProductImageGeneration,
    ImageProductionWorkflowStage.BackgroundGeneration,
    ImageProductionWorkflowStage.ImageEditing,
    ImageProductionWorkflowStage.ImageEnhancement,
    ImageProductionWorkflowStage.Branding,
    ImageProductionWorkflowStage.MultiStyleGeneration,
    ImageProductionWorkflowStage.ProductionWorkflow,
];
export const ALL_IMAGE_PRODUCTION_ASSET_TYPES = [
    ImageProductionAssetType.SourceImage,
    ImageProductionAssetType.GeneratedImage,
    ImageProductionAssetType.Logo,
    ImageProductionAssetType.Font,
    ImageProductionAssetType.Icon,
    ImageProductionAssetType.Template,
    ImageProductionAssetType.Layer,
    ImageProductionAssetType.Mask,
    ImageProductionAssetType.Texture,
    ImageProductionAssetType.BrandAsset,
    ImageProductionAssetType.ColorProfile,
    ImageProductionAssetType.Metadata,
];
export const ALL_IMAGE_PRODUCTION_DEPENDENCIES = [
    ImageProductionDependency.MemoryEngine,
    ImageProductionDependency.KnowledgeEngine,
    ImageProductionDependency.ProductIntelligenceEngine,
    ImageProductionDependency.ImageIntelligenceEngine,
    ImageProductionDependency.VideoIntelligenceEngine,
    ImageProductionDependency.ImageGenerationFoundation,
    ImageProductionDependency.TextToImageEngine,
    ImageProductionDependency.ImageToImageEngine,
    ImageProductionDependency.ProductImageEngine,
    ImageProductionDependency.BackgroundEngine,
    ImageProductionDependency.ImageEditingEngine,
    ImageProductionDependency.EnhancementEngine,
    ImageProductionDependency.BrandingEngine,
    ImageProductionDependency.MultiStyleEngine,
];
export const ALL_IMAGE_PRODUCTION_EXPORT_FORMATS = [
    ImageProductionExportFormat.Png,
    ImageProductionExportFormat.Jpg,
    ImageProductionExportFormat.Webp,
    ImageProductionExportFormat.Tiff,
    ImageProductionExportFormat.Svg,
    ImageProductionExportFormat.Pdf,
];
export const IMAGE_PRODUCTION_PLATFORM_CONFIG = {
    [ImageProductionPlatform.Website]: { aspectRatio: "16:9", resolution: "1920x1080", width: 1920, height: 1080, dpi: 72 },
    [ImageProductionPlatform.Mobile]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920, dpi: 72 },
    [ImageProductionPlatform.Instagram]: { aspectRatio: "1:1", resolution: "1080x1080", width: 1080, height: 1080, dpi: 72 },
    [ImageProductionPlatform.Facebook]: { aspectRatio: "1.91:1", resolution: "1200x628", width: 1200, height: 628, dpi: 72 },
    [ImageProductionPlatform.TikTok]: { aspectRatio: "9:16", resolution: "1080x1920", width: 1080, height: 1920, dpi: 72 },
    [ImageProductionPlatform.LinkedIn]: { aspectRatio: "1.91:1", resolution: "1200x627", width: 1200, height: 627, dpi: 72 },
    [ImageProductionPlatform.Print]: { aspectRatio: "3:2", resolution: "3000x2000", width: 3000, height: 2000, dpi: 300 },
    [ImageProductionPlatform.Packaging]: { aspectRatio: "1:1", resolution: "2048x2048", width: 2048, height: 2048, dpi: 300 },
    [ImageProductionPlatform.Billboard]: { aspectRatio: "3:1", resolution: "6000x2000", width: 6000, height: 2000, dpi: 150 },
};
export const WORKFLOW_MODULE_MAP = {
    [ImageProductionWorkflowStage.TextToImage]: "text-to-image-generation-engine",
    [ImageProductionWorkflowStage.ImageToImage]: "image-to-image-generation-engine",
    [ImageProductionWorkflowStage.ProductImageGeneration]: "product-image-generation-engine",
    [ImageProductionWorkflowStage.BackgroundGeneration]: "background-generation-engine",
    [ImageProductionWorkflowStage.ImageEditing]: "image-editing-generation-engine",
    [ImageProductionWorkflowStage.ImageEnhancement]: "image-enhancement-generation-engine",
    [ImageProductionWorkflowStage.Branding]: "branding-design-generation-engine",
    [ImageProductionWorkflowStage.MultiStyleGeneration]: "multi-style-image-generation-engine",
    [ImageProductionWorkflowStage.ProductionWorkflow]: "image-production-engine",
};
export const DEPENDENCY_MODULE_MAP = {
    [ImageProductionDependency.TextToImageEngine]: "text-to-image-generation-engine",
    [ImageProductionDependency.ImageToImageEngine]: "image-to-image-generation-engine",
    [ImageProductionDependency.ProductImageEngine]: "product-image-generation-engine",
    [ImageProductionDependency.BackgroundEngine]: "background-generation-engine",
    [ImageProductionDependency.ImageEditingEngine]: "image-editing-generation-engine",
    [ImageProductionDependency.EnhancementEngine]: "image-enhancement-generation-engine",
    [ImageProductionDependency.BrandingEngine]: "branding-design-generation-engine",
    [ImageProductionDependency.MultiStyleEngine]: "multi-style-image-generation-engine",
};
//# sourceMappingURL=types.js.map