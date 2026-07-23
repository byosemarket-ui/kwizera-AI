/**
 * KWIZERA AI STUDIO — AI Video Generation Foundation types (Step 8A)
 */
export var VideoGenerationLifecycleState;
(function (VideoGenerationLifecycleState) {
    VideoGenerationLifecycleState["Initializing"] = "initializing";
    VideoGenerationLifecycleState["Loading"] = "loading";
    VideoGenerationLifecycleState["Ready"] = "ready";
    VideoGenerationLifecycleState["Preparing"] = "preparing";
    VideoGenerationLifecycleState["Generating"] = "generating";
    VideoGenerationLifecycleState["Validating"] = "validating";
    VideoGenerationLifecycleState["Optimizing"] = "optimizing";
    VideoGenerationLifecycleState["RenderPreparation"] = "render-preparation";
    VideoGenerationLifecycleState["ExportPreparation"] = "export-preparation";
    VideoGenerationLifecycleState["Archiving"] = "archiving";
    VideoGenerationLifecycleState["Recovering"] = "recovering";
    VideoGenerationLifecycleState["Closing"] = "closing";
    VideoGenerationLifecycleState["Closed"] = "closed";
})(VideoGenerationLifecycleState || (VideoGenerationLifecycleState = {}));
export var VideoGenerationCategory;
(function (VideoGenerationCategory) {
    VideoGenerationCategory["StoryGeneration"] = "story-generation";
    VideoGenerationCategory["SceneGeneration"] = "scene-generation";
    VideoGenerationCategory["ShotGeneration"] = "shot-generation";
    VideoGenerationCategory["CameraPlanning"] = "camera-planning-generation";
    VideoGenerationCategory["MotionPlanning"] = "motion-planning-generation";
    VideoGenerationCategory["AnimationPlanning"] = "animation-planning-generation";
    VideoGenerationCategory["VisualEffectsPlanning"] = "visual-effects-planning-generation";
    VideoGenerationCategory["AudioSynchronization"] = "audio-sync-generation";
    VideoGenerationCategory["MarketingVideoPlanning"] = "marketing-video-generation";
    VideoGenerationCategory["VideoProductionPlanning"] = "video-production-generation";
    VideoGenerationCategory["RenderingPlanning"] = "rendering-planning-generation";
    VideoGenerationCategory["VideoQualityValidation"] = "video-quality-validation";
    VideoGenerationCategory["VideoGenerationOptimization"] = "video-generation-optimization";
    VideoGenerationCategory["ExportPlanning"] = "export-planning-generation";
    VideoGenerationCategory["BatchGeneration"] = "batch-generation";
    VideoGenerationCategory["DistributedGeneration"] = "distributed-generation";
    VideoGenerationCategory["CloudGeneration"] = "cloud-generation-preparation";
    VideoGenerationCategory["GenerationHealthMonitoring"] = "generation-health-monitor";
})(VideoGenerationCategory || (VideoGenerationCategory = {}));
export var VideoGenerationModuleStatus;
(function (VideoGenerationModuleStatus) {
    VideoGenerationModuleStatus["Prepared"] = "prepared";
    VideoGenerationModuleStatus["Registered"] = "registered";
    VideoGenerationModuleStatus["Active"] = "active";
    VideoGenerationModuleStatus["Disabled"] = "disabled";
    VideoGenerationModuleStatus["Validating"] = "validating";
    VideoGenerationModuleStatus["Recovering"] = "recovering";
    VideoGenerationModuleStatus["Failed"] = "failed";
})(VideoGenerationModuleStatus || (VideoGenerationModuleStatus = {}));
export var VideoGenerationHealthLevel;
(function (VideoGenerationHealthLevel) {
    VideoGenerationHealthLevel["Excellent"] = "excellent";
    VideoGenerationHealthLevel["Good"] = "good";
    VideoGenerationHealthLevel["Warning"] = "warning";
    VideoGenerationHealthLevel["Critical"] = "critical";
    VideoGenerationHealthLevel["Failed"] = "failed";
})(VideoGenerationHealthLevel || (VideoGenerationHealthLevel = {}));
export var VideoGenerationSource;
(function (VideoGenerationSource) {
    VideoGenerationSource["MemoryEngine"] = "memory-engine";
    VideoGenerationSource["KnowledgeEngine"] = "knowledge-engine";
    VideoGenerationSource["ProductIntelligenceEngine"] = "product-intelligence-engine";
    VideoGenerationSource["ImageIntelligenceEngine"] = "image-intelligence-engine";
    VideoGenerationSource["VideoIntelligenceEngine"] = "video-intelligence-engine";
    VideoGenerationSource["ProductionPlan"] = "production-plan";
    VideoGenerationSource["Storyboard"] = "storyboard";
    VideoGenerationSource["Script"] = "script";
    VideoGenerationSource["UserInput"] = "user-input";
    VideoGenerationSource["System"] = "system";
    VideoGenerationSource["Manual"] = "manual";
})(VideoGenerationSource || (VideoGenerationSource = {}));
export var VideoGenerationVerificationStatus;
(function (VideoGenerationVerificationStatus) {
    VideoGenerationVerificationStatus["Unverified"] = "unverified";
    VideoGenerationVerificationStatus["Pending"] = "pending";
    VideoGenerationVerificationStatus["Verified"] = "verified";
    VideoGenerationVerificationStatus["Rejected"] = "rejected";
    VideoGenerationVerificationStatus["Archived"] = "archived";
})(VideoGenerationVerificationStatus || (VideoGenerationVerificationStatus = {}));
export var VideoGenerationAccessPermission;
(function (VideoGenerationAccessPermission) {
    VideoGenerationAccessPermission["Read"] = "read";
    VideoGenerationAccessPermission["Write"] = "write";
    VideoGenerationAccessPermission["Update"] = "update";
    VideoGenerationAccessPermission["Delete"] = "delete";
    VideoGenerationAccessPermission["Validate"] = "validate";
    VideoGenerationAccessPermission["Admin"] = "admin";
})(VideoGenerationAccessPermission || (VideoGenerationAccessPermission = {}));
export var VideoGenerationAccessOperation;
(function (VideoGenerationAccessOperation) {
    VideoGenerationAccessOperation["Read"] = "read";
    VideoGenerationAccessOperation["Write"] = "write";
    VideoGenerationAccessOperation["Update"] = "update";
    VideoGenerationAccessOperation["Delete"] = "delete";
    VideoGenerationAccessOperation["Validate"] = "validate";
    VideoGenerationAccessOperation["Query"] = "query";
})(VideoGenerationAccessOperation || (VideoGenerationAccessOperation = {}));
export var GenerationAssetType;
(function (GenerationAssetType) {
    GenerationAssetType["Storyboard"] = "storyboard";
    GenerationAssetType["Script"] = "script";
    GenerationAssetType["Scene"] = "scene";
    GenerationAssetType["Timeline"] = "timeline";
    GenerationAssetType["CameraPlan"] = "camera-plan";
    GenerationAssetType["MotionPlan"] = "motion-plan";
    GenerationAssetType["Character"] = "character";
    GenerationAssetType["Background"] = "background";
    GenerationAssetType["Image"] = "image";
    GenerationAssetType["Audio"] = "audio";
    GenerationAssetType["Voice"] = "voice";
    GenerationAssetType["Music"] = "music";
    GenerationAssetType["Effect"] = "effect";
    GenerationAssetType["Transition"] = "transition";
    GenerationAssetType["Template"] = "template";
    GenerationAssetType["ExportProfile"] = "export-profile";
})(GenerationAssetType || (GenerationAssetType = {}));
export var GenerationBlueprintStage;
(function (GenerationBlueprintStage) {
    GenerationBlueprintStage["StoryGeneration"] = "story-generation";
    GenerationBlueprintStage["SceneGeneration"] = "scene-generation";
    GenerationBlueprintStage["ShotGeneration"] = "shot-generation";
    GenerationBlueprintStage["CameraPlanning"] = "camera-planning";
    GenerationBlueprintStage["MotionPlanning"] = "motion-planning";
    GenerationBlueprintStage["AnimationPlanning"] = "animation-planning";
    GenerationBlueprintStage["VisualEffectsPlanning"] = "visual-effects-planning";
    GenerationBlueprintStage["AudioSynchronization"] = "audio-synchronization";
    GenerationBlueprintStage["MarketingVideoPlanning"] = "marketing-video-planning";
    GenerationBlueprintStage["VideoProductionPlanning"] = "video-production-planning";
    GenerationBlueprintStage["RenderingPlanning"] = "rendering-planning";
    GenerationBlueprintStage["VideoQualityValidation"] = "video-quality-validation";
    GenerationBlueprintStage["VideoGenerationOptimization"] = "video-generation-optimization";
    GenerationBlueprintStage["ExportPlanning"] = "export-planning";
})(GenerationBlueprintStage || (GenerationBlueprintStage = {}));
export var GenerationWorkflowActionType;
(function (GenerationWorkflowActionType) {
    GenerationWorkflowActionType["Generate"] = "generate";
    GenerationWorkflowActionType["Edit"] = "edit";
    GenerationWorkflowActionType["Replace"] = "replace";
    GenerationWorkflowActionType["Sync"] = "sync";
    GenerationWorkflowActionType["Plan"] = "plan";
    GenerationWorkflowActionType["Validate"] = "validate";
    GenerationWorkflowActionType["Optimize"] = "optimize";
    GenerationWorkflowActionType["Restore"] = "restore";
    GenerationWorkflowActionType["Rollback"] = "rollback";
})(GenerationWorkflowActionType || (GenerationWorkflowActionType = {}));
export var GenerationPlatformTarget;
(function (GenerationPlatformTarget) {
    GenerationPlatformTarget["YouTube"] = "youtube";
    GenerationPlatformTarget["Instagram"] = "instagram";
    GenerationPlatformTarget["TikTok"] = "tiktok";
    GenerationPlatformTarget["Facebook"] = "facebook";
    GenerationPlatformTarget["Website"] = "website";
    GenerationPlatformTarget["Broadcast"] = "broadcast";
    GenerationPlatformTarget["Custom"] = "custom";
})(GenerationPlatformTarget || (GenerationPlatformTarget = {}));
export class VideoGenerationFoundationError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoGenerationFoundationError";
    }
}
//# sourceMappingURL=types.js.map