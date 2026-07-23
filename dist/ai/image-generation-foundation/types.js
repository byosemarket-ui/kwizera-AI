/**
 * KWIZERA AI STUDIO — AI Image Generation Foundation types (Step 9A)
 */
export var ImageGenerationLifecycleState;
(function (ImageGenerationLifecycleState) {
    ImageGenerationLifecycleState["Initializing"] = "initializing";
    ImageGenerationLifecycleState["Loading"] = "loading";
    ImageGenerationLifecycleState["Ready"] = "ready";
    ImageGenerationLifecycleState["Preparing"] = "preparing";
    ImageGenerationLifecycleState["Generating"] = "generating";
    ImageGenerationLifecycleState["Validating"] = "validating";
    ImageGenerationLifecycleState["Optimizing"] = "optimizing";
    ImageGenerationLifecycleState["RenderPreparation"] = "render-preparation";
    ImageGenerationLifecycleState["ExportPreparation"] = "export-preparation";
    ImageGenerationLifecycleState["Archiving"] = "archiving";
    ImageGenerationLifecycleState["Recovering"] = "recovering";
    ImageGenerationLifecycleState["Closing"] = "closing";
    ImageGenerationLifecycleState["Closed"] = "closed";
})(ImageGenerationLifecycleState || (ImageGenerationLifecycleState = {}));
export var ImageGenerationCategory;
(function (ImageGenerationCategory) {
    ImageGenerationCategory["TextToImage"] = "text-to-image-generation";
    ImageGenerationCategory["ImageToImage"] = "image-to-image-generation";
    ImageGenerationCategory["ProductImageGeneration"] = "product-image-generation";
    ImageGenerationCategory["BackgroundGeneration"] = "background-generation";
    ImageGenerationCategory["ImageEditing"] = "image-editing-generation";
    ImageGenerationCategory["Inpainting"] = "inpainting-generation";
    ImageGenerationCategory["Outpainting"] = "outpainting-generation";
    ImageGenerationCategory["ImageEnhancement"] = "image-enhancement-generation";
    ImageGenerationCategory["BrandingDesign"] = "branding-design-generation";
    ImageGenerationCategory["MultiStyleImageGeneration"] = "multi-style-image-generation";
    ImageGenerationCategory["ImageProduction"] = "image-production";
    ImageGenerationCategory["RenderingPlanning"] = "image-rendering-planning";
    ImageGenerationCategory["ImageQualityValidation"] = "image-quality-validation";
    ImageGenerationCategory["ImageGenerationOptimization"] = "image-generation-optimization";
    ImageGenerationCategory["ExportPlanning"] = "image-export-planning";
    ImageGenerationCategory["BatchGeneration"] = "batch-image-generation";
    ImageGenerationCategory["DistributedGeneration"] = "distributed-image-generation";
    ImageGenerationCategory["CloudGeneration"] = "cloud-image-generation-preparation";
    ImageGenerationCategory["GenerationHealthMonitoring"] = "image-generation-health-monitor";
})(ImageGenerationCategory || (ImageGenerationCategory = {}));
export var ImageGenerationModuleStatus;
(function (ImageGenerationModuleStatus) {
    ImageGenerationModuleStatus["Prepared"] = "prepared";
    ImageGenerationModuleStatus["Registered"] = "registered";
    ImageGenerationModuleStatus["Active"] = "active";
    ImageGenerationModuleStatus["Disabled"] = "disabled";
    ImageGenerationModuleStatus["Validating"] = "validating";
    ImageGenerationModuleStatus["Recovering"] = "recovering";
    ImageGenerationModuleStatus["Failed"] = "failed";
})(ImageGenerationModuleStatus || (ImageGenerationModuleStatus = {}));
export var ImageGenerationHealthLevel;
(function (ImageGenerationHealthLevel) {
    ImageGenerationHealthLevel["Excellent"] = "excellent";
    ImageGenerationHealthLevel["Good"] = "good";
    ImageGenerationHealthLevel["Warning"] = "warning";
    ImageGenerationHealthLevel["Critical"] = "critical";
    ImageGenerationHealthLevel["Failed"] = "failed";
})(ImageGenerationHealthLevel || (ImageGenerationHealthLevel = {}));
export var ImageGenerationSource;
(function (ImageGenerationSource) {
    ImageGenerationSource["MemoryEngine"] = "memory-engine";
    ImageGenerationSource["KnowledgeEngine"] = "knowledge-engine";
    ImageGenerationSource["ProductIntelligenceEngine"] = "product-intelligence-engine";
    ImageGenerationSource["ImageIntelligenceEngine"] = "image-intelligence-engine";
    ImageGenerationSource["VideoIntelligenceEngine"] = "video-intelligence-engine";
    ImageGenerationSource["VideoGenerationEngine"] = "video-generation-engine";
    ImageGenerationSource["ProductionPlan"] = "production-plan";
    ImageGenerationSource["Prompt"] = "prompt";
    ImageGenerationSource["Template"] = "template";
    ImageGenerationSource["UserInput"] = "user-input";
    ImageGenerationSource["System"] = "system";
    ImageGenerationSource["Manual"] = "manual";
})(ImageGenerationSource || (ImageGenerationSource = {}));
export var ImageGenerationVerificationStatus;
(function (ImageGenerationVerificationStatus) {
    ImageGenerationVerificationStatus["Unverified"] = "unverified";
    ImageGenerationVerificationStatus["Pending"] = "pending";
    ImageGenerationVerificationStatus["Verified"] = "verified";
    ImageGenerationVerificationStatus["Rejected"] = "rejected";
    ImageGenerationVerificationStatus["Archived"] = "archived";
})(ImageGenerationVerificationStatus || (ImageGenerationVerificationStatus = {}));
export var ImageGenerationAccessPermission;
(function (ImageGenerationAccessPermission) {
    ImageGenerationAccessPermission["Read"] = "read";
    ImageGenerationAccessPermission["Write"] = "write";
    ImageGenerationAccessPermission["Update"] = "update";
    ImageGenerationAccessPermission["Delete"] = "delete";
    ImageGenerationAccessPermission["Validate"] = "validate";
    ImageGenerationAccessPermission["Admin"] = "admin";
})(ImageGenerationAccessPermission || (ImageGenerationAccessPermission = {}));
export var ImageGenerationAccessOperation;
(function (ImageGenerationAccessOperation) {
    ImageGenerationAccessOperation["Read"] = "read";
    ImageGenerationAccessOperation["Write"] = "write";
    ImageGenerationAccessOperation["Update"] = "update";
    ImageGenerationAccessOperation["Delete"] = "delete";
    ImageGenerationAccessOperation["Validate"] = "validate";
    ImageGenerationAccessOperation["Query"] = "query";
})(ImageGenerationAccessOperation || (ImageGenerationAccessOperation = {}));
export var ImageGenerationAssetType;
(function (ImageGenerationAssetType) {
    ImageGenerationAssetType["Prompt"] = "prompt";
    ImageGenerationAssetType["Image"] = "image";
    ImageGenerationAssetType["ProductImage"] = "product-image";
    ImageGenerationAssetType["Character"] = "character";
    ImageGenerationAssetType["Background"] = "background";
    ImageGenerationAssetType["Logo"] = "logo";
    ImageGenerationAssetType["BrandAsset"] = "brand-asset";
    ImageGenerationAssetType["Style"] = "style";
    ImageGenerationAssetType["Template"] = "template";
    ImageGenerationAssetType["Mask"] = "mask";
    ImageGenerationAssetType["Layer"] = "layer";
    ImageGenerationAssetType["Variation"] = "variation";
    ImageGenerationAssetType["RenderProfile"] = "render-profile";
})(ImageGenerationAssetType || (ImageGenerationAssetType = {}));
export var ImageGenerationBlueprintStage;
(function (ImageGenerationBlueprintStage) {
    ImageGenerationBlueprintStage["TextToImage"] = "text-to-image";
    ImageGenerationBlueprintStage["ImageToImage"] = "image-to-image";
    ImageGenerationBlueprintStage["ProductImageGeneration"] = "product-image-generation";
    ImageGenerationBlueprintStage["BackgroundGeneration"] = "background-generation";
    ImageGenerationBlueprintStage["ImageEditing"] = "image-editing";
    ImageGenerationBlueprintStage["Inpainting"] = "inpainting";
    ImageGenerationBlueprintStage["Outpainting"] = "outpainting";
    ImageGenerationBlueprintStage["ImageEnhancement"] = "image-enhancement";
    ImageGenerationBlueprintStage["BrandingDesign"] = "branding-design";
    ImageGenerationBlueprintStage["MultiStyleImageGeneration"] = "multi-style-image-generation";
    ImageGenerationBlueprintStage["ImageProduction"] = "image-production";
    ImageGenerationBlueprintStage["RenderingPlanning"] = "rendering-planning";
    ImageGenerationBlueprintStage["ImageQualityValidation"] = "image-quality-validation";
    ImageGenerationBlueprintStage["ImageGenerationOptimization"] = "image-generation-optimization";
    ImageGenerationBlueprintStage["ExportPlanning"] = "export-planning";
})(ImageGenerationBlueprintStage || (ImageGenerationBlueprintStage = {}));
export var ImageGenerationWorkflowActionType;
(function (ImageGenerationWorkflowActionType) {
    ImageGenerationWorkflowActionType["Generate"] = "generate";
    ImageGenerationWorkflowActionType["Edit"] = "edit";
    ImageGenerationWorkflowActionType["Replace"] = "replace";
    ImageGenerationWorkflowActionType["Sync"] = "sync";
    ImageGenerationWorkflowActionType["Plan"] = "plan";
    ImageGenerationWorkflowActionType["Validate"] = "validate";
    ImageGenerationWorkflowActionType["Optimize"] = "optimize";
    ImageGenerationWorkflowActionType["Restore"] = "restore";
    ImageGenerationWorkflowActionType["Rollback"] = "rollback";
})(ImageGenerationWorkflowActionType || (ImageGenerationWorkflowActionType = {}));
export var ImageGenerationPlatformTarget;
(function (ImageGenerationPlatformTarget) {
    ImageGenerationPlatformTarget["Instagram"] = "instagram";
    ImageGenerationPlatformTarget["Pinterest"] = "pinterest";
    ImageGenerationPlatformTarget["Facebook"] = "facebook";
    ImageGenerationPlatformTarget["Website"] = "website";
    ImageGenerationPlatformTarget["Ecommerce"] = "ecommerce";
    ImageGenerationPlatformTarget["Print"] = "print";
    ImageGenerationPlatformTarget["Custom"] = "custom";
})(ImageGenerationPlatformTarget || (ImageGenerationPlatformTarget = {}));
export var ImageGenerationResolutionTarget;
(function (ImageGenerationResolutionTarget) {
    ImageGenerationResolutionTarget["Thumbnail"] = "thumbnail";
    ImageGenerationResolutionTarget["Standard"] = "standard";
    ImageGenerationResolutionTarget["High"] = "high";
    ImageGenerationResolutionTarget["Ultra"] = "ultra";
    ImageGenerationResolutionTarget["Print"] = "print";
    ImageGenerationResolutionTarget["Custom"] = "custom";
})(ImageGenerationResolutionTarget || (ImageGenerationResolutionTarget = {}));
export class ImageGenerationFoundationError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageGenerationFoundationError";
    }
}
//# sourceMappingURL=types.js.map