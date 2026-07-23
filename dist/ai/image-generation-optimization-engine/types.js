/**
 * KWIZERA AI STUDIO — Image Generation Optimization Engine types (Step 9M)
 */
export var OptimizationPlatform;
(function (OptimizationPlatform) {
    OptimizationPlatform["Website"] = "website";
    OptimizationPlatform["Mobile"] = "mobile";
    OptimizationPlatform["Instagram"] = "instagram";
    OptimizationPlatform["Facebook"] = "facebook";
    OptimizationPlatform["TikTok"] = "tiktok";
    OptimizationPlatform["LinkedIn"] = "linkedin";
    OptimizationPlatform["Print"] = "print";
    OptimizationPlatform["Packaging"] = "packaging";
    OptimizationPlatform["Billboard"] = "billboard";
})(OptimizationPlatform || (OptimizationPlatform = {}));
export var PipelineOptimizationArea;
(function (PipelineOptimizationArea) {
    PipelineOptimizationArea["PromptUnderstanding"] = "prompt-understanding";
    PipelineOptimizationArea["ImageComposition"] = "image-composition";
    PipelineOptimizationArea["LayerStructure"] = "layer-structure";
    PipelineOptimizationArea["MaskStructure"] = "mask-structure";
    PipelineOptimizationArea["ColorManagement"] = "color-management";
    PipelineOptimizationArea["Typography"] = "typography";
    PipelineOptimizationArea["AssetOrganization"] = "asset-organization";
    PipelineOptimizationArea["Metadata"] = "metadata";
})(PipelineOptimizationArea || (PipelineOptimizationArea = {}));
export class ImageGenerationOptimizationEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageGenerationOptimizationEngineError";
    }
}
export const ALL_PIPELINE_OPTIMIZATION_AREAS = [
    PipelineOptimizationArea.PromptUnderstanding,
    PipelineOptimizationArea.ImageComposition,
    PipelineOptimizationArea.LayerStructure,
    PipelineOptimizationArea.MaskStructure,
    PipelineOptimizationArea.ColorManagement,
    PipelineOptimizationArea.Typography,
    PipelineOptimizationArea.AssetOrganization,
    PipelineOptimizationArea.Metadata,
];
export const ALL_OPTIMIZATION_PLATFORMS = [
    OptimizationPlatform.Website,
    OptimizationPlatform.Mobile,
    OptimizationPlatform.Instagram,
    OptimizationPlatform.Facebook,
    OptimizationPlatform.TikTok,
    OptimizationPlatform.LinkedIn,
    OptimizationPlatform.Print,
    OptimizationPlatform.Packaging,
    OptimizationPlatform.Billboard,
];
export const PIPELINE_COMPONENT_KEYS = [
    "promptProcessingOptimized",
    "textToImageOptimized",
    "imageToImageOptimized",
    "productImageOptimized",
    "backgroundOptimized",
    "imageEditingOptimized",
    "enhancementOptimized",
    "brandingOptimized",
    "multiStyleOptimized",
    "productionOptimized",
    "renderPreparationOptimized",
    "validationResultsOptimized",
];
//# sourceMappingURL=types.js.map