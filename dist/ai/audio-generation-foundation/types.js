/**
 * KWIZERA AI STUDIO — AI Audio Generation Foundation types (Step 10A)
 */
export var AudioGenerationLifecycleState;
(function (AudioGenerationLifecycleState) {
    AudioGenerationLifecycleState["Initializing"] = "initializing";
    AudioGenerationLifecycleState["Loading"] = "loading";
    AudioGenerationLifecycleState["Ready"] = "ready";
    AudioGenerationLifecycleState["Preparing"] = "preparing";
    AudioGenerationLifecycleState["Generating"] = "generating";
    AudioGenerationLifecycleState["Validating"] = "validating";
    AudioGenerationLifecycleState["Optimizing"] = "optimizing";
    AudioGenerationLifecycleState["RenderPreparation"] = "render-preparation";
    AudioGenerationLifecycleState["ExportPreparation"] = "export-preparation";
    AudioGenerationLifecycleState["Archiving"] = "archiving";
    AudioGenerationLifecycleState["Recovering"] = "recovering";
    AudioGenerationLifecycleState["Closing"] = "closing";
    AudioGenerationLifecycleState["Closed"] = "closed";
})(AudioGenerationLifecycleState || (AudioGenerationLifecycleState = {}));
export var AudioGenerationCategory;
(function (AudioGenerationCategory) {
    AudioGenerationCategory["TextToSpeech"] = "text-to-speech-generation";
    AudioGenerationCategory["SpeechToSpeech"] = "speech-to-speech-generation";
    AudioGenerationCategory["VoiceCloning"] = "voice-cloning-generation";
    AudioGenerationCategory["MusicGeneration"] = "music-generation";
    AudioGenerationCategory["SoundEffectsGeneration"] = "sound-effects-generation";
    AudioGenerationCategory["AmbientAudioGeneration"] = "ambient-audio-generation";
    AudioGenerationCategory["AudioEnhancement"] = "audio-enhancement-generation";
    AudioGenerationCategory["AudioRestoration"] = "audio-restoration-generation";
    AudioGenerationCategory["AudioMixing"] = "audio-mixing-generation";
    AudioGenerationCategory["AudioMastering"] = "audio-mastering-generation";
    AudioGenerationCategory["AudioProduction"] = "audio-production";
    AudioGenerationCategory["RenderingPlanning"] = "audio-rendering-planning";
    AudioGenerationCategory["AudioQualityValidation"] = "audio-quality-validation";
    AudioGenerationCategory["ExportPlanning"] = "audio-export-planning";
    AudioGenerationCategory["BatchGeneration"] = "batch-audio-generation";
    AudioGenerationCategory["DistributedGeneration"] = "distributed-audio-generation";
    AudioGenerationCategory["CloudGeneration"] = "cloud-audio-generation-preparation";
    AudioGenerationCategory["RealTimePreparation"] = "real-time-audio-preparation";
    AudioGenerationCategory["GenerationHealthMonitoring"] = "audio-generation-health-monitor";
})(AudioGenerationCategory || (AudioGenerationCategory = {}));
export var AudioGenerationModuleStatus;
(function (AudioGenerationModuleStatus) {
    AudioGenerationModuleStatus["Prepared"] = "prepared";
    AudioGenerationModuleStatus["Registered"] = "registered";
    AudioGenerationModuleStatus["Active"] = "active";
    AudioGenerationModuleStatus["Disabled"] = "disabled";
    AudioGenerationModuleStatus["Validating"] = "validating";
    AudioGenerationModuleStatus["Recovering"] = "recovering";
    AudioGenerationModuleStatus["Failed"] = "failed";
})(AudioGenerationModuleStatus || (AudioGenerationModuleStatus = {}));
export var AudioGenerationHealthLevel;
(function (AudioGenerationHealthLevel) {
    AudioGenerationHealthLevel["Excellent"] = "excellent";
    AudioGenerationHealthLevel["Good"] = "good";
    AudioGenerationHealthLevel["Warning"] = "warning";
    AudioGenerationHealthLevel["Critical"] = "critical";
    AudioGenerationHealthLevel["Failed"] = "failed";
})(AudioGenerationHealthLevel || (AudioGenerationHealthLevel = {}));
export var AudioGenerationSource;
(function (AudioGenerationSource) {
    AudioGenerationSource["MemoryEngine"] = "memory-engine";
    AudioGenerationSource["KnowledgeEngine"] = "knowledge-engine";
    AudioGenerationSource["ProductIntelligenceEngine"] = "product-intelligence-engine";
    AudioGenerationSource["ImageIntelligenceEngine"] = "image-intelligence-engine";
    AudioGenerationSource["VideoIntelligenceEngine"] = "video-intelligence-engine";
    AudioGenerationSource["VideoGenerationEngine"] = "video-generation-engine";
    AudioGenerationSource["ImageGenerationEngine"] = "image-generation-engine";
    AudioGenerationSource["ProductionPlan"] = "production-plan";
    AudioGenerationSource["Prompt"] = "prompt";
    AudioGenerationSource["Template"] = "template";
    AudioGenerationSource["Voice"] = "voice";
    AudioGenerationSource["UserInput"] = "user-input";
    AudioGenerationSource["System"] = "system";
    AudioGenerationSource["Manual"] = "manual";
})(AudioGenerationSource || (AudioGenerationSource = {}));
export var AudioGenerationVerificationStatus;
(function (AudioGenerationVerificationStatus) {
    AudioGenerationVerificationStatus["Unverified"] = "unverified";
    AudioGenerationVerificationStatus["Pending"] = "pending";
    AudioGenerationVerificationStatus["Verified"] = "verified";
    AudioGenerationVerificationStatus["Rejected"] = "rejected";
    AudioGenerationVerificationStatus["Archived"] = "archived";
})(AudioGenerationVerificationStatus || (AudioGenerationVerificationStatus = {}));
export var AudioGenerationAccessPermission;
(function (AudioGenerationAccessPermission) {
    AudioGenerationAccessPermission["Read"] = "read";
    AudioGenerationAccessPermission["Write"] = "write";
    AudioGenerationAccessPermission["Update"] = "update";
    AudioGenerationAccessPermission["Delete"] = "delete";
    AudioGenerationAccessPermission["Validate"] = "validate";
    AudioGenerationAccessPermission["Admin"] = "admin";
})(AudioGenerationAccessPermission || (AudioGenerationAccessPermission = {}));
export var AudioGenerationAccessOperation;
(function (AudioGenerationAccessOperation) {
    AudioGenerationAccessOperation["Read"] = "read";
    AudioGenerationAccessOperation["Write"] = "write";
    AudioGenerationAccessOperation["Update"] = "update";
    AudioGenerationAccessOperation["Delete"] = "delete";
    AudioGenerationAccessOperation["Validate"] = "validate";
    AudioGenerationAccessOperation["Query"] = "query";
})(AudioGenerationAccessOperation || (AudioGenerationAccessOperation = {}));
export var AudioGenerationAssetType;
(function (AudioGenerationAssetType) {
    AudioGenerationAssetType["Prompt"] = "prompt";
    AudioGenerationAssetType["Voice"] = "voice";
    AudioGenerationAssetType["VoiceProfile"] = "voice-profile";
    AudioGenerationAssetType["AudioTrack"] = "audio-track";
    AudioGenerationAssetType["Music"] = "music";
    AudioGenerationAssetType["SoundEffect"] = "sound-effect";
    AudioGenerationAssetType["AmbientSound"] = "ambient-sound";
    AudioGenerationAssetType["Narration"] = "narration";
    AudioGenerationAssetType["Podcast"] = "podcast";
    AudioGenerationAssetType["Template"] = "template";
    AudioGenerationAssetType["Preset"] = "preset";
    AudioGenerationAssetType["RenderProfile"] = "render-profile";
})(AudioGenerationAssetType || (AudioGenerationAssetType = {}));
export var AudioGenerationBlueprintStage;
(function (AudioGenerationBlueprintStage) {
    AudioGenerationBlueprintStage["TextToSpeech"] = "text-to-speech";
    AudioGenerationBlueprintStage["SpeechToSpeech"] = "speech-to-speech";
    AudioGenerationBlueprintStage["VoiceCloning"] = "voice-cloning";
    AudioGenerationBlueprintStage["MusicGeneration"] = "music-generation";
    AudioGenerationBlueprintStage["SoundEffectsGeneration"] = "sound-effects-generation";
    AudioGenerationBlueprintStage["AmbientAudioGeneration"] = "ambient-audio-generation";
    AudioGenerationBlueprintStage["AudioEnhancement"] = "audio-enhancement";
    AudioGenerationBlueprintStage["AudioRestoration"] = "audio-restoration";
    AudioGenerationBlueprintStage["AudioMixing"] = "audio-mixing";
    AudioGenerationBlueprintStage["AudioMastering"] = "audio-mastering";
    AudioGenerationBlueprintStage["AudioProduction"] = "audio-production";
    AudioGenerationBlueprintStage["RenderingPlanning"] = "rendering-planning";
    AudioGenerationBlueprintStage["AudioQualityValidation"] = "audio-quality-validation";
    AudioGenerationBlueprintStage["ExportPlanning"] = "export-planning";
})(AudioGenerationBlueprintStage || (AudioGenerationBlueprintStage = {}));
export var AudioGenerationWorkflowActionType;
(function (AudioGenerationWorkflowActionType) {
    AudioGenerationWorkflowActionType["Generate"] = "generate";
    AudioGenerationWorkflowActionType["Edit"] = "edit";
    AudioGenerationWorkflowActionType["Replace"] = "replace";
    AudioGenerationWorkflowActionType["Sync"] = "sync";
    AudioGenerationWorkflowActionType["Plan"] = "plan";
    AudioGenerationWorkflowActionType["Validate"] = "validate";
    AudioGenerationWorkflowActionType["Optimize"] = "optimize";
    AudioGenerationWorkflowActionType["Restore"] = "restore";
    AudioGenerationWorkflowActionType["Rollback"] = "rollback";
})(AudioGenerationWorkflowActionType || (AudioGenerationWorkflowActionType = {}));
export var AudioGenerationPlatformTarget;
(function (AudioGenerationPlatformTarget) {
    AudioGenerationPlatformTarget["Podcast"] = "podcast";
    AudioGenerationPlatformTarget["Spotify"] = "spotify";
    AudioGenerationPlatformTarget["YouTube"] = "youtube";
    AudioGenerationPlatformTarget["Social"] = "social";
    AudioGenerationPlatformTarget["Broadcast"] = "broadcast";
    AudioGenerationPlatformTarget["Elearning"] = "elearning";
    AudioGenerationPlatformTarget["Custom"] = "custom";
})(AudioGenerationPlatformTarget || (AudioGenerationPlatformTarget = {}));
export var AudioGenerationQualityTarget;
(function (AudioGenerationQualityTarget) {
    AudioGenerationQualityTarget["Low"] = "low";
    AudioGenerationQualityTarget["Standard"] = "standard";
    AudioGenerationQualityTarget["High"] = "high";
    AudioGenerationQualityTarget["Studio"] = "studio";
    AudioGenerationQualityTarget["Broadcast"] = "broadcast";
    AudioGenerationQualityTarget["Custom"] = "custom";
})(AudioGenerationQualityTarget || (AudioGenerationQualityTarget = {}));
export class AudioGenerationFoundationError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "AudioGenerationFoundationError";
    }
}
//# sourceMappingURL=types.js.map