/**

 * KWIZERA AI STUDIO — Video Intelligence Health Monitor Engine types (Step 7N)

 */
export var VideoIntelligenceHealthScoreLevel;
(function (VideoIntelligenceHealthScoreLevel) {
    VideoIntelligenceHealthScoreLevel["Excellent"] = "excellent";
    VideoIntelligenceHealthScoreLevel["Good"] = "good";
    VideoIntelligenceHealthScoreLevel["Warning"] = "warning";
    VideoIntelligenceHealthScoreLevel["Critical"] = "critical";
    VideoIntelligenceHealthScoreLevel["Failed"] = "failed";
})(VideoIntelligenceHealthScoreLevel || (VideoIntelligenceHealthScoreLevel = {}));
export var MonitoredVideoIntelligenceModule;
(function (MonitoredVideoIntelligenceModule) {
    MonitoredVideoIntelligenceModule["VideoIntelligenceFoundation"] = "video-intelligence-foundation";
    MonitoredVideoIntelligenceModule["VideoAnalysis"] = "video-analysis-engine";
    MonitoredVideoIntelligenceModule["VideoUnderstanding"] = "video-understanding-engine";
    MonitoredVideoIntelligenceModule["SceneDetection"] = "scene-intelligence";
    MonitoredVideoIntelligenceModule["TimelineIntelligence"] = "timeline-intelligence";
    MonitoredVideoIntelligenceModule["CameraMovement"] = "camera-intelligence";
    MonitoredVideoIntelligenceModule["MotionIntelligence"] = "motion-intelligence";
    MonitoredVideoIntelligenceModule["VideoStyle"] = "video-style-intelligence";
    MonitoredVideoIntelligenceModule["VideoEnhancementPlanning"] = "video-enhancement-planning";
    MonitoredVideoIntelligenceModule["CreativeVideoIntelligence"] = "creative-video-intelligence";
    MonitoredVideoIntelligenceModule["ProductionVideoPlanning"] = "production-video-planning";
    MonitoredVideoIntelligenceModule["VideoQualityPrediction"] = "video-quality-prediction";
    MonitoredVideoIntelligenceModule["VideoIntelligenceOptimization"] = "video-intelligence-optimization";
    MonitoredVideoIntelligenceModule["VideoIntelligenceRegistry"] = "video-intelligence-registry";
    MonitoredVideoIntelligenceModule["VideoIntelligenceDatabase"] = "video-intelligence-database";
    MonitoredVideoIntelligenceModule["TimelineDatabase"] = "timeline-database";
    MonitoredVideoIntelligenceModule["VideoRelationships"] = "video-relationships";
    MonitoredVideoIntelligenceModule["VideoSearch"] = "video-search";
    MonitoredVideoIntelligenceModule["VideoCache"] = "video-cache";
})(MonitoredVideoIntelligenceModule || (MonitoredVideoIntelligenceModule = {}));
export var VideoIntelligenceWarningType;
(function (VideoIntelligenceWarningType) {
    VideoIntelligenceWarningType["VideoAnalysisFailure"] = "video-analysis-failure";
    VideoIntelligenceWarningType["SceneDetectionFailure"] = "scene-detection-failure";
    VideoIntelligenceWarningType["TimelineProblems"] = "timeline-problems";
    VideoIntelligenceWarningType["MotionProblems"] = "motion-problems";
    VideoIntelligenceWarningType["CameraProblems"] = "camera-problems";
    VideoIntelligenceWarningType["StyleProblems"] = "style-problems";
    VideoIntelligenceWarningType["EnhancementPlanningProblems"] = "enhancement-planning-problems";
    VideoIntelligenceWarningType["CreativePlanningProblems"] = "creative-planning-problems";
    VideoIntelligenceWarningType["ProductionPlanningProblems"] = "production-planning-problems";
    VideoIntelligenceWarningType["RelationshipFailure"] = "relationship-failure";
    VideoIntelligenceWarningType["BrokenDependencies"] = "broken-dependencies";
    VideoIntelligenceWarningType["HighResourceUsage"] = "high-resource-usage";
    VideoIntelligenceWarningType["SearchFailure"] = "search-failure";
    VideoIntelligenceWarningType["DatabaseProblems"] = "database-problems";
    VideoIntelligenceWarningType["RegistryProblems"] = "registry-problems";
    VideoIntelligenceWarningType["CacheProblems"] = "cache-problems";
})(VideoIntelligenceWarningType || (VideoIntelligenceWarningType = {}));
export class VideoIntelligenceHealthMonitorEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "VideoIntelligenceHealthMonitorEngineError";
    }
}
//# sourceMappingURL=types.js.map