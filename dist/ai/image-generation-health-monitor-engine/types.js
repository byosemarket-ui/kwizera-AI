/**
 * KWIZERA AI STUDIO — Image Generation Health Monitor Engine types (Step 9N)
 */
export var ImageGenerationHealthScoreLevel;
(function (ImageGenerationHealthScoreLevel) {
    ImageGenerationHealthScoreLevel["Excellent"] = "excellent";
    ImageGenerationHealthScoreLevel["Good"] = "good";
    ImageGenerationHealthScoreLevel["Warning"] = "warning";
    ImageGenerationHealthScoreLevel["Critical"] = "critical";
    ImageGenerationHealthScoreLevel["Failed"] = "failed";
})(ImageGenerationHealthScoreLevel || (ImageGenerationHealthScoreLevel = {}));
export var MonitoredImageGenerationModule;
(function (MonitoredImageGenerationModule) {
    MonitoredImageGenerationModule["ImageGenerationFoundation"] = "image-generation-foundation";
    MonitoredImageGenerationModule["TextToImageGeneration"] = "text-to-image-generation-engine";
    MonitoredImageGenerationModule["ImageToImageGeneration"] = "image-to-image-generation-engine";
    MonitoredImageGenerationModule["ProductImageGeneration"] = "product-image-generation-engine";
    MonitoredImageGenerationModule["BackgroundGeneration"] = "background-generation-engine";
    MonitoredImageGenerationModule["ImageEditing"] = "image-editing-generation-engine";
    MonitoredImageGenerationModule["ImageEnhancement"] = "image-enhancement-generation-engine";
    MonitoredImageGenerationModule["BrandingDesign"] = "branding-design-generation-engine";
    MonitoredImageGenerationModule["MultiStyleImageGeneration"] = "multi-style-image-generation-engine";
    MonitoredImageGenerationModule["ImageProduction"] = "image-production-engine";
    MonitoredImageGenerationModule["ImageRenderingPreparation"] = "image-rendering-preparation-engine";
    MonitoredImageGenerationModule["ImageQualityValidation"] = "image-quality-validation-engine";
    MonitoredImageGenerationModule["ImageGenerationOptimization"] = "image-generation-optimization-engine";
    MonitoredImageGenerationModule["AssetRegistry"] = "asset-registry";
    MonitoredImageGenerationModule["PromptRegistry"] = "prompt-registry";
    MonitoredImageGenerationModule["LayerRegistry"] = "layer-registry";
    MonitoredImageGenerationModule["MaskRegistry"] = "mask-registry";
    MonitoredImageGenerationModule["ProductionRegistry"] = "production-registry";
})(MonitoredImageGenerationModule || (MonitoredImageGenerationModule = {}));
export var ImageGenerationWarningType;
(function (ImageGenerationWarningType) {
    ImageGenerationWarningType["PromptProblems"] = "prompt-problems";
    ImageGenerationWarningType["ImageProblems"] = "image-problems";
    ImageGenerationWarningType["LayerProblems"] = "layer-problems";
    ImageGenerationWarningType["MaskProblems"] = "mask-problems";
    ImageGenerationWarningType["BrandingProblems"] = "branding-problems";
    ImageGenerationWarningType["ProductionProblems"] = "production-problems";
    ImageGenerationWarningType["RenderPreparationProblems"] = "render-preparation-problems";
    ImageGenerationWarningType["ValidationProblems"] = "validation-problems";
    ImageGenerationWarningType["RelationshipFailure"] = "relationship-failure";
    ImageGenerationWarningType["BrokenDependencies"] = "broken-dependencies";
    ImageGenerationWarningType["HighResourceUsage"] = "high-resource-usage";
    ImageGenerationWarningType["SearchFailure"] = "search-failure";
    ImageGenerationWarningType["DatabaseProblems"] = "database-problems";
    ImageGenerationWarningType["RegistryProblems"] = "registry-problems";
    ImageGenerationWarningType["CacheProblems"] = "cache-problems";
})(ImageGenerationWarningType || (ImageGenerationWarningType = {}));
export class ImageGenerationHealthMonitorEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageGenerationHealthMonitorEngineError";
    }
}
//# sourceMappingURL=types.js.map