/**
 * KWIZERA AI STUDIO — Video Intelligence Foundation types (Step 7A)
 */
export var VideoIntelligenceLifecycleState;
(function (VideoIntelligenceLifecycleState) {
    VideoIntelligenceLifecycleState["Initializing"] = "initializing";
    VideoIntelligenceLifecycleState["Loading"] = "loading";
    VideoIntelligenceLifecycleState["Ready"] = "ready";
    VideoIntelligenceLifecycleState["Analyzing"] = "analyzing";
    VideoIntelligenceLifecycleState["Planning"] = "planning";
    VideoIntelligenceLifecycleState["Indexing"] = "indexing";
    VideoIntelligenceLifecycleState["Validating"] = "validating";
    VideoIntelligenceLifecycleState["Optimizing"] = "optimizing";
    VideoIntelligenceLifecycleState["Recovering"] = "recovering";
    VideoIntelligenceLifecycleState["Closing"] = "closing";
    VideoIntelligenceLifecycleState["Closed"] = "closed";
})(VideoIntelligenceLifecycleState || (VideoIntelligenceLifecycleState = {}));
export var VideoIntelligenceCategory;
(function (VideoIntelligenceCategory) {
    VideoIntelligenceCategory["VideoAnalysis"] = "video-analysis";
    VideoIntelligenceCategory["VideoUnderstanding"] = "video-understanding";
    VideoIntelligenceCategory["SceneIntelligence"] = "scene-intelligence";
    VideoIntelligenceCategory["TimelineIntelligence"] = "timeline-intelligence";
    VideoIntelligenceCategory["AudioIntelligence"] = "audio-intelligence";
    VideoIntelligenceCategory["SubtitleIntelligence"] = "subtitle-intelligence";
    VideoIntelligenceCategory["MotionIntelligence"] = "motion-intelligence";
    VideoIntelligenceCategory["CameraIntelligence"] = "camera-intelligence";
    VideoIntelligenceCategory["CompositionVideo"] = "composition-video-intelligence";
    VideoIntelligenceCategory["BrandVideo"] = "brand-video-intelligence";
    VideoIntelligenceCategory["EnhancementPlanning"] = "video-enhancement-planning";
    VideoIntelligenceCategory["CreativeVideo"] = "creative-video-intelligence";
    VideoIntelligenceCategory["ProductionPlanning"] = "production-video-planning";
    VideoIntelligenceCategory["QualityPrediction"] = "video-quality-prediction";
    VideoIntelligenceCategory["Optimization"] = "video-intelligence-optimization";
    VideoIntelligenceCategory["HealthMonitoring"] = "video-intelligence-health-monitor";
})(VideoIntelligenceCategory || (VideoIntelligenceCategory = {}));
export var VideoIntelligenceModuleStatus;
(function (VideoIntelligenceModuleStatus) {
    VideoIntelligenceModuleStatus["Prepared"] = "prepared";
    VideoIntelligenceModuleStatus["Registered"] = "registered";
    VideoIntelligenceModuleStatus["Active"] = "active";
    VideoIntelligenceModuleStatus["Disabled"] = "disabled";
    VideoIntelligenceModuleStatus["Validating"] = "validating";
    VideoIntelligenceModuleStatus["Recovering"] = "recovering";
    VideoIntelligenceModuleStatus["Failed"] = "failed";
})(VideoIntelligenceModuleStatus || (VideoIntelligenceModuleStatus = {}));
export var VideoIntelligenceHealthLevel;
(function (VideoIntelligenceHealthLevel) {
    VideoIntelligenceHealthLevel["Excellent"] = "excellent";
    VideoIntelligenceHealthLevel["Good"] = "good";
    VideoIntelligenceHealthLevel["Warning"] = "warning";
    VideoIntelligenceHealthLevel["Critical"] = "critical";
    VideoIntelligenceHealthLevel["Failed"] = "failed";
})(VideoIntelligenceHealthLevel || (VideoIntelligenceHealthLevel = {}));
export var VideoIntelligenceSource;
(function (VideoIntelligenceSource) {
    VideoIntelligenceSource["MemoryEngine"] = "memory-engine";
    VideoIntelligenceSource["KnowledgeEngine"] = "knowledge-engine";
    VideoIntelligenceSource["ProductIntelligenceEngine"] = "product-intelligence-engine";
    VideoIntelligenceSource["ImageIntelligenceEngine"] = "image-intelligence-engine";
    VideoIntelligenceSource["VideoKnowledge"] = "video-knowledge";
    VideoIntelligenceSource["StoryboardPlanning"] = "storyboard-planning";
    VideoIntelligenceSource["CreativeDirection"] = "creative-direction";
    VideoIntelligenceSource["UserInput"] = "user-input";
    VideoIntelligenceSource["System"] = "system";
    VideoIntelligenceSource["Manual"] = "manual";
})(VideoIntelligenceSource || (VideoIntelligenceSource = {}));
export var VideoIntelligenceVerificationStatus;
(function (VideoIntelligenceVerificationStatus) {
    VideoIntelligenceVerificationStatus["Unverified"] = "unverified";
    VideoIntelligenceVerificationStatus["Pending"] = "pending";
    VideoIntelligenceVerificationStatus["Verified"] = "verified";
    VideoIntelligenceVerificationStatus["Rejected"] = "rejected";
    VideoIntelligenceVerificationStatus["Archived"] = "archived";
})(VideoIntelligenceVerificationStatus || (VideoIntelligenceVerificationStatus = {}));
export var VideoIntelligenceAccessPermission;
(function (VideoIntelligenceAccessPermission) {
    VideoIntelligenceAccessPermission["Read"] = "read";
    VideoIntelligenceAccessPermission["Write"] = "write";
    VideoIntelligenceAccessPermission["Update"] = "update";
    VideoIntelligenceAccessPermission["Delete"] = "delete";
    VideoIntelligenceAccessPermission["Validate"] = "validate";
    VideoIntelligenceAccessPermission["Admin"] = "admin";
})(VideoIntelligenceAccessPermission || (VideoIntelligenceAccessPermission = {}));
export var VideoIntelligenceAccessOperation;
(function (VideoIntelligenceAccessOperation) {
    VideoIntelligenceAccessOperation["Read"] = "read";
    VideoIntelligenceAccessOperation["Write"] = "write";
    VideoIntelligenceAccessOperation["Update"] = "update";
    VideoIntelligenceAccessOperation["Delete"] = "delete";
    VideoIntelligenceAccessOperation["Validate"] = "validate";
    VideoIntelligenceAccessOperation["Query"] = "query";
})(VideoIntelligenceAccessOperation || (VideoIntelligenceAccessOperation = {}));
export var VideoAssetType;
(function (VideoAssetType) {
    VideoAssetType["OriginalVideo"] = "original-video";
    VideoAssetType["ProxyVideo"] = "proxy-video";
    VideoAssetType["RenderedVideo"] = "rendered-video";
    VideoAssetType["AudioTrack"] = "audio-track";
    VideoAssetType["VoiceTrack"] = "voice-track";
    VideoAssetType["Music"] = "music";
    VideoAssetType["SoundEffect"] = "sound-effect";
    VideoAssetType["Subtitle"] = "subtitle";
    VideoAssetType["Caption"] = "caption";
    VideoAssetType["Transition"] = "transition";
    VideoAssetType["Effect"] = "effect";
    VideoAssetType["LUT"] = "lut";
    VideoAssetType["MotionGraphic"] = "motion-graphic";
    VideoAssetType["Overlay"] = "overlay";
    VideoAssetType["Logo"] = "logo";
    VideoAssetType["Template"] = "template";
    VideoAssetType["ExportProfile"] = "export-profile";
})(VideoAssetType || (VideoAssetType = {}));
export var VideoIndexType;
(function (VideoIndexType) {
    VideoIndexType["Frame"] = "frame";
    VideoIndexType["Keyframe"] = "keyframe";
    VideoIndexType["Scene"] = "scene";
    VideoIndexType["Timeline"] = "timeline";
    VideoIndexType["Shot"] = "shot";
    VideoIndexType["Sequence"] = "sequence";
})(VideoIndexType || (VideoIndexType = {}));
export var VideoAspectRatio;
(function (VideoAspectRatio) {
    VideoAspectRatio["Landscape16x9"] = "16:9";
    VideoAspectRatio["Portrait9x16"] = "9:16";
    VideoAspectRatio["Square1x1"] = "1:1";
    VideoAspectRatio["Cinema21x9"] = "21:9";
    VideoAspectRatio["Custom"] = "custom";
})(VideoAspectRatio || (VideoAspectRatio = {}));
export var VideoWorkflowActionType;
(function (VideoWorkflowActionType) {
    VideoWorkflowActionType["Edit"] = "edit";
    VideoWorkflowActionType["Trim"] = "trim";
    VideoWorkflowActionType["Overlay"] = "overlay";
    VideoWorkflowActionType["AudioMix"] = "audio-mix";
    VideoWorkflowActionType["SubtitleEdit"] = "subtitle-edit";
    VideoWorkflowActionType["ColorGrade"] = "color-grade";
    VideoWorkflowActionType["Transition"] = "transition";
    VideoWorkflowActionType["Restore"] = "restore";
})(VideoWorkflowActionType || (VideoWorkflowActionType = {}));
export class VideoIntelligenceFoundationError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoIntelligenceFoundationError";
    }
}
//# sourceMappingURL=types.js.map