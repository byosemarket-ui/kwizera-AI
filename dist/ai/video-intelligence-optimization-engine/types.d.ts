/**

 * KWIZERA AI STUDIO — Video Intelligence Optimization Engine types (Step 7M)

 */
import type { VideoQualityPredictionPlatform } from "../video-quality-prediction-engine/types.js";
export type VideoOptimizationStrategyType = "relationship" | "timeline" | "scene" | "motion" | "camera" | "search" | "recommendation" | "workflow" | "performance" | "cache" | "metadata";
export interface VideoOptimizationProfile {
    optimizationId: string;
    projectId: string;
    videoId: string;
    product: string;
    brand: string;
    campaign: string;
    platform: VideoQualityPredictionPlatform;
    optimizationVersion: number;
}
export interface VideoModuleOptimizationResult {
    moduleId: string;
    moduleName: string;
    qualityScoreBefore: number;
    qualityScoreAfter: number;
    improved: boolean;
    strategiesApplied: VideoOptimizationStrategyType[];
    detail: string;
}
export interface VideoOptimizationStrategies {
    relationshipOptimization: string;
    timelineOptimization: string;
    sceneOptimization: string;
    motionOptimization: string;
    cameraOptimization: string;
    searchOptimization: string;
    recommendationOptimization: string;
    workflowOptimization: string;
    performanceOptimization: string;
    cacheOptimization: string;
    metadataOptimization: string;
}
export interface VideoCacheOptimization {
    videos: string[];
    scenes: string[];
    timelines: string[];
    storyboards: string[];
    brands: string[];
    products: string[];
    templates: string[];
    campaigns: string[];
    productionPlans: string[];
    hitRate: number;
}
export interface VideoIntelligenceRecoveryPoint {
    recoveryId: string;
    optimizationId: string;
    createdAt: string;
    baselineMetrics: Record<string, number>;
    cacheSnapshot: VideoCacheOptimization;
    restored: boolean;
}
export interface VideoOptimizationPerformanceMetrics {
    analysisSpeedMs: number;
    planningSpeedMs: number;
    searchSpeedMs: number;
    recommendationSpeedMs: number;
    timelineProcessingMs: number;
    analysisSpeedBeforeMs: number;
    planningSpeedBeforeMs: number;
    searchSpeedBeforeMs: number;
    memoryEstimateMb: number;
    diskUsageEstimateKb: number;
}
export interface VideoOptimizationScores {
    overallImprovementScore: number;
    videoQualityImprovementScore: number;
    storytellingImprovementScore: number;
    planningImprovementScore: number;
    searchImprovementScore: number;
    recommendationImprovementScore: number;
    relationshipImprovementScore: number;
    workflowEfficiencyScore: number;
    renderingReadinessScore: number;
    confidenceImprovementScore: number;
    aiConfidenceScore: number;
}
export interface VideoIntelligenceOptimizationRelationships {
    relatedStoryboards: string[];
    relatedProductionPlans: string[];
    relatedEnhancementPlans: string[];
    relatedProducts: string[];
    relatedBrands: string[];
    relatedCampaigns: string[];
    qualityPredictions: string[];
    knowledgeRecords: string[];
}
export interface VideoIntelligenceOptimizationInput {
    videoId: string;
    optimizationId?: string;
    projectId?: string;
}
export interface VideoIntelligenceOptimizationRecord {
    optimizationId: string;
    videoId: string;
    projectId: string;
    qualityPredictionId: string;
    productionPlanId: string;
    profile: VideoOptimizationProfile;
    moduleResults: VideoModuleOptimizationResult[];
    strategies: VideoOptimizationStrategies;
    cache: VideoCacheOptimization;
    performance: VideoOptimizationPerformanceMetrics;
    scores: VideoOptimizationScores;
    relationships: VideoIntelligenceOptimizationRelationships;
    recoveryPointId: string;
    validated: boolean;
    productionReady: boolean;
    createdAt: string;
    lastUpdated: string;
    version: number;
}
export interface VideoIntelligenceOptimizationResult {
    success: boolean;
    record?: VideoIntelligenceOptimizationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
    recovered?: boolean;
}
export interface VideoIntelligenceOptimizationSearchQuery {
    optimizationId?: string;
    videoId?: string;
    brand?: string;
    platform?: VideoQualityPredictionPlatform;
    campaign?: string;
    minImprovementScore?: number;
    text?: string;
    limit?: number;
}
export interface VideoIntelligenceOptimizationEngineStatusReport {
    engineStatus: string;
    optimizationStatus: string;
    cacheStatus: string;
    recoveryStatus: string;
    optimizationsCompleted: number;
    averageImprovementScore: number;
    averageStorytellingImprovement: number;
    performance: {
        averageOptimizationMs: number;
        averageSearchMs: number;
        averageRecoveryMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class VideoIntelligenceOptimizationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map