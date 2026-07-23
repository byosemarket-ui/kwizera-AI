/**
 * KWIZERA AI STUDIO — Image Intelligence Health Monitor Engine types (Step 6N)
 */
export declare enum ImageIntelligenceHealthScoreLevel {
    Excellent = "excellent",
    Good = "good",
    Warning = "warning",
    Critical = "critical",
    Failed = "failed"
}
export declare enum MonitoredImageIntelligenceModule {
    ImageIntelligenceFoundation = "image-intelligence-foundation",
    ImageAnalysis = "image-analysis-engine",
    ImageUnderstanding = "image-understanding-engine",
    ObjectDetection = "object-detection-intelligence-engine",
    BackgroundIntelligence = "background-intelligence-engine",
    CompositionIntelligence = "composition-intelligence-engine",
    LightingColorIntelligence = "lighting-color-intelligence-engine",
    BrandVisualIntelligence = "brand-visual-intelligence-engine",
    ImageEnhancementPlanning = "image-enhancement-planning-engine",
    CreativeImageIntelligence = "creative-image-intelligence-engine",
    ProductionImagePlanning = "production-image-planning-engine",
    ImageQualityPrediction = "image-quality-prediction-engine",
    ImageIntelligenceOptimization = "image-intelligence-optimization-engine",
    ImageIntelligenceRegistry = "image-intelligence-registry",
    ImageIntelligenceDatabase = "image-intelligence-database",
    ImageRelationships = "image-relationships",
    ImageSearch = "image-search",
    ImageCache = "image-cache"
}
export declare enum ImageIntelligenceWarningType {
    ImageAnalysisFailure = "image-analysis-failure",
    RelationshipFailure = "relationship-failure",
    BrokenDependencies = "broken-dependencies",
    InvalidImageMetadata = "invalid-image-metadata",
    ObjectDetectionProblems = "object-detection-problems",
    BackgroundAnalysisProblems = "background-analysis-problems",
    CompositionProblems = "composition-problems",
    LightingProblems = "lighting-problems",
    BrandConsistencyProblems = "brand-consistency-problems",
    CreativePlanningProblems = "creative-planning-problems",
    ProductionPlanningProblems = "production-planning-problems",
    HighResourceUsage = "high-resource-usage",
    SearchFailure = "search-failure",
    DatabaseProblems = "database-problems",
    RegistryProblems = "registry-problems",
    CacheProblems = "cache-problems"
}
export interface MonitoredImageIntelligenceModuleHealthScore {
    module: MonitoredImageIntelligenceModule;
    score: number;
    level: ImageIntelligenceHealthScoreLevel;
    available: boolean;
    issues: string[];
}
export interface ImageIntelligenceHealthWarning {
    type: ImageIntelligenceWarningType;
    severity: ImageIntelligenceHealthScoreLevel;
    message: string;
    module: MonitoredImageIntelligenceModule;
    recommendation: string;
}
export interface ImageIntelligenceHealthCheckResult {
    checkId: string;
    timestamp: string;
    overallScore: number;
    overallLevel: ImageIntelligenceHealthScoreLevel;
    moduleScores: MonitoredImageIntelligenceModuleHealthScore[];
    warnings: ImageIntelligenceHealthWarning[];
    errors: string[];
    repairs: string[];
    recommendations: string[];
    performance: {
        checkDurationMs: number;
        searchPerformanceMs: number;
        planningPerformanceMs: number;
        relationshipDetectionMs: number;
        diskUsageMb: number;
        memoryUsageMb: number;
        cpuUsagePercent: number;
    };
    imageQualityIntegrity: boolean;
    planningIntegrity: boolean;
    relationshipIntegrity: boolean;
    optimizationStatus: boolean;
    qualityPredictionStatus: boolean;
    recoveryNotified: boolean;
}
export interface ImageIntelligenceAuditResult {
    auditId: string;
    timestamp: string;
    imageQuality: boolean;
    planningIntegrity: boolean;
    relationshipIntegrity: boolean;
    creativeConsistency: boolean;
    brandConsistency: boolean;
    dependencyValidation: boolean;
    optimizationStatus: boolean;
    qualityPredictionStatus: boolean;
    valid: boolean;
    durationMs: number;
}
export interface ImageIntelligenceHealthHistoryEntry {
    checkId: string;
    timestamp: string;
    module: string;
    healthScore: number;
    level: ImageIntelligenceHealthScoreLevel;
    warnings: string[];
    errors: string[];
    repairs: string[];
    recommendations: string[];
    performanceMs: number;
}
export interface ImageIntelligenceTrendAnalysis {
    direction: "improving" | "stable" | "declining";
    averageScore: number;
    scoreChange: number;
    warningTrend: number;
    prediction: string;
}
export interface ImageIntelligenceAutoRepairResult {
    attempted: boolean;
    success: boolean;
    repairs: string[];
    validated: boolean;
}
export interface ImageIntelligenceHealthMonitorStatusReport {
    engineStatus: string;
    overallImageIntelligenceHealth: string;
    moduleHealthSummary: string;
    imageQuality: string;
    relationshipHealth: string;
    totalChecks: number;
    totalWarnings: number;
    performance: {
        averageCheckMs: number;
        lastCheckMs: number;
        averageDiskMb: number;
    };
    trendAnalysis: ImageIntelligenceTrendAnalysis;
    recommendations: string[];
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ImageIntelligenceHealthMonitorEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map