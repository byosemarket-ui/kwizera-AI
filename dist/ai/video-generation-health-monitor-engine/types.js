/**
 * KWIZERA AI STUDIO — Video Generation Health Monitor Engine types (Step 8N)
 */
export var VideoGenerationHealthScoreLevel;
(function (VideoGenerationHealthScoreLevel) {
    VideoGenerationHealthScoreLevel["Excellent"] = "excellent";
    VideoGenerationHealthScoreLevel["Good"] = "good";
    VideoGenerationHealthScoreLevel["Warning"] = "warning";
    VideoGenerationHealthScoreLevel["Critical"] = "critical";
    VideoGenerationHealthScoreLevel["Failed"] = "failed";
})(VideoGenerationHealthScoreLevel || (VideoGenerationHealthScoreLevel = {}));
export var MonitoredVideoGenerationModule;
(function (MonitoredVideoGenerationModule) {
    MonitoredVideoGenerationModule["VideoGenerationFoundation"] = "video-generation-foundation";
    MonitoredVideoGenerationModule["StoryboardGeneration"] = "story-generation-engine";
    MonitoredVideoGenerationModule["SceneGeneration"] = "scene-generation-engine";
    MonitoredVideoGenerationModule["CameraDirector"] = "camera-planning-generation-engine";
    MonitoredVideoGenerationModule["MotionGeneration"] = "motion-planning-generation-engine";
    MonitoredVideoGenerationModule["Animation"] = "animation-planning-generation-engine";
    MonitoredVideoGenerationModule["VisualEffects"] = "visual-effects-planning-generation-engine";
    MonitoredVideoGenerationModule["AudioSynchronization"] = "audio-sync-generation-engine";
    MonitoredVideoGenerationModule["MarketingVideo"] = "marketing-video-generation-engine";
    MonitoredVideoGenerationModule["VideoProduction"] = "video-production-generation-engine";
    MonitoredVideoGenerationModule["RenderingPreparation"] = "rendering-planning-generation-engine";
    MonitoredVideoGenerationModule["VideoQualityValidation"] = "video-quality-validation-engine";
    MonitoredVideoGenerationModule["VideoGenerationOptimization"] = "video-generation-optimization-engine";
    MonitoredVideoGenerationModule["RenderQueuePreparation"] = "render-queue-preparation";
    MonitoredVideoGenerationModule["AssetRegistry"] = "asset-registry";
    MonitoredVideoGenerationModule["TimelineRegistry"] = "timeline-registry";
    MonitoredVideoGenerationModule["ProductionRegistry"] = "production-registry";
})(MonitoredVideoGenerationModule || (MonitoredVideoGenerationModule = {}));
export var VideoGenerationWarningType;
(function (VideoGenerationWarningType) {
    VideoGenerationWarningType["StoryboardProblems"] = "storyboard-problems";
    VideoGenerationWarningType["SceneProblems"] = "scene-problems";
    VideoGenerationWarningType["CameraProblems"] = "camera-problems";
    VideoGenerationWarningType["MotionProblems"] = "motion-problems";
    VideoGenerationWarningType["AnimationProblems"] = "animation-problems";
    VideoGenerationWarningType["VisualEffectsProblems"] = "visual-effects-problems";
    VideoGenerationWarningType["AudioProblems"] = "audio-problems";
    VideoGenerationWarningType["MarketingProblems"] = "marketing-problems";
    VideoGenerationWarningType["ProductionProblems"] = "production-problems";
    VideoGenerationWarningType["RenderPreparationProblems"] = "render-preparation-problems";
    VideoGenerationWarningType["ValidationProblems"] = "validation-problems";
    VideoGenerationWarningType["RelationshipFailure"] = "relationship-failure";
    VideoGenerationWarningType["BrokenDependencies"] = "broken-dependencies";
    VideoGenerationWarningType["HighResourceUsage"] = "high-resource-usage";
    VideoGenerationWarningType["SearchFailure"] = "search-failure";
    VideoGenerationWarningType["DatabaseProblems"] = "database-problems";
    VideoGenerationWarningType["RegistryProblems"] = "registry-problems";
    VideoGenerationWarningType["CacheProblems"] = "cache-problems";
})(VideoGenerationWarningType || (VideoGenerationWarningType = {}));
export class VideoGenerationHealthMonitorEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoGenerationHealthMonitorEngineError";
    }
}
//# sourceMappingURL=types.js.map