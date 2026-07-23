/**
 * KWIZERA AI STUDIO — Image Intelligence Health Monitor Engine types (Step 6N)
 */
export var ImageIntelligenceHealthScoreLevel;
(function (ImageIntelligenceHealthScoreLevel) {
    ImageIntelligenceHealthScoreLevel["Excellent"] = "excellent";
    ImageIntelligenceHealthScoreLevel["Good"] = "good";
    ImageIntelligenceHealthScoreLevel["Warning"] = "warning";
    ImageIntelligenceHealthScoreLevel["Critical"] = "critical";
    ImageIntelligenceHealthScoreLevel["Failed"] = "failed";
})(ImageIntelligenceHealthScoreLevel || (ImageIntelligenceHealthScoreLevel = {}));
export var MonitoredImageIntelligenceModule;
(function (MonitoredImageIntelligenceModule) {
    MonitoredImageIntelligenceModule["ImageIntelligenceFoundation"] = "image-intelligence-foundation";
    MonitoredImageIntelligenceModule["ImageAnalysis"] = "image-analysis-engine";
    MonitoredImageIntelligenceModule["ImageUnderstanding"] = "image-understanding-engine";
    MonitoredImageIntelligenceModule["ObjectDetection"] = "object-detection-intelligence-engine";
    MonitoredImageIntelligenceModule["BackgroundIntelligence"] = "background-intelligence-engine";
    MonitoredImageIntelligenceModule["CompositionIntelligence"] = "composition-intelligence-engine";
    MonitoredImageIntelligenceModule["LightingColorIntelligence"] = "lighting-color-intelligence-engine";
    MonitoredImageIntelligenceModule["BrandVisualIntelligence"] = "brand-visual-intelligence-engine";
    MonitoredImageIntelligenceModule["ImageEnhancementPlanning"] = "image-enhancement-planning-engine";
    MonitoredImageIntelligenceModule["CreativeImageIntelligence"] = "creative-image-intelligence-engine";
    MonitoredImageIntelligenceModule["ProductionImagePlanning"] = "production-image-planning-engine";
    MonitoredImageIntelligenceModule["ImageQualityPrediction"] = "image-quality-prediction-engine";
    MonitoredImageIntelligenceModule["ImageIntelligenceOptimization"] = "image-intelligence-optimization-engine";
    MonitoredImageIntelligenceModule["ImageIntelligenceRegistry"] = "image-intelligence-registry";
    MonitoredImageIntelligenceModule["ImageIntelligenceDatabase"] = "image-intelligence-database";
    MonitoredImageIntelligenceModule["ImageRelationships"] = "image-relationships";
    MonitoredImageIntelligenceModule["ImageSearch"] = "image-search";
    MonitoredImageIntelligenceModule["ImageCache"] = "image-cache";
})(MonitoredImageIntelligenceModule || (MonitoredImageIntelligenceModule = {}));
export var ImageIntelligenceWarningType;
(function (ImageIntelligenceWarningType) {
    ImageIntelligenceWarningType["ImageAnalysisFailure"] = "image-analysis-failure";
    ImageIntelligenceWarningType["RelationshipFailure"] = "relationship-failure";
    ImageIntelligenceWarningType["BrokenDependencies"] = "broken-dependencies";
    ImageIntelligenceWarningType["InvalidImageMetadata"] = "invalid-image-metadata";
    ImageIntelligenceWarningType["ObjectDetectionProblems"] = "object-detection-problems";
    ImageIntelligenceWarningType["BackgroundAnalysisProblems"] = "background-analysis-problems";
    ImageIntelligenceWarningType["CompositionProblems"] = "composition-problems";
    ImageIntelligenceWarningType["LightingProblems"] = "lighting-problems";
    ImageIntelligenceWarningType["BrandConsistencyProblems"] = "brand-consistency-problems";
    ImageIntelligenceWarningType["CreativePlanningProblems"] = "creative-planning-problems";
    ImageIntelligenceWarningType["ProductionPlanningProblems"] = "production-planning-problems";
    ImageIntelligenceWarningType["HighResourceUsage"] = "high-resource-usage";
    ImageIntelligenceWarningType["SearchFailure"] = "search-failure";
    ImageIntelligenceWarningType["DatabaseProblems"] = "database-problems";
    ImageIntelligenceWarningType["RegistryProblems"] = "registry-problems";
    ImageIntelligenceWarningType["CacheProblems"] = "cache-problems";
})(ImageIntelligenceWarningType || (ImageIntelligenceWarningType = {}));
export class ImageIntelligenceHealthMonitorEngineError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "ImageIntelligenceHealthMonitorEngineError";
    }
}
//# sourceMappingURL=types.js.map