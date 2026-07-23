/**
 * KWIZERA AI STUDIO — AI Video Generation Optimization Engine types (Step 8M)
 */
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
export declare enum OptimizationPlanType {
    Standard = "standard",
    Performance = "performance",
    Resource = "resource",
    Combined = "combined"
}
export interface OptimizationProfile {
    optimizationId: string;
    projectId: string;
    validationId: string;
    renderPlanId: string;
    productionId: string;
    videoId: string;
    platform: StoryboardGenerationPlatform;
    optimizationVersion: number;
}
export interface ComponentOptimizationPlan {
    storyboardOptimized: boolean;
    scenesOptimized: boolean;
    cameraPlansOptimized: boolean;
    motionPlansOptimized: boolean;
    animationPlansOptimized: boolean;
    visualEffectsPlansOptimized: boolean;
    audioSyncOptimized: boolean;
    marketingPlansOptimized: boolean;
    productionPlansOptimized: boolean;
    renderPreparationOptimized: boolean;
    validationResultsOptimized: boolean;
    notes: string[];
}
export interface PipelineOptimizationPlan {
    storyFlow: string;
    sceneOrder: string;
    timelineEfficiency: string;
    cameraEfficiency: string;
    motionSmoothness: string;
    animationTiming: string;
    effectTiming: string;
    audioTiming: string;
    subtitleTiming: string;
    creativeDecisionsPreserved: boolean;
    allPipelineOptimized: boolean;
}
export interface ResourceOptimizationPlan {
    cpuUsage: string;
    gpuUsage: string;
    ramUsage: string;
    diskUsage: string;
    cacheUsage: string;
    temporaryFiles: string;
    backgroundProcessing: string;
    parallelProcessing: string;
    allResourcesOptimized: boolean;
}
export interface QualityOptimizationPlan {
    visualQuality: string;
    audioQuality: string;
    motionQuality: string;
    animationQuality: string;
    cameraQuality: string;
    subtitleQuality: string;
    brandConsistency: string;
    marketingEffectiveness: string;
    qualityMaintainedOrImproved: boolean;
    allQualityOptimized: boolean;
}
export interface SearchOptimizationPlan {
    searchIndexes: string;
    metadata: string;
    assetRetrieval: string;
    relationshipQueries: string;
    cachePerformance: string;
    allSearchOptimized: boolean;
}
export interface RecoveryOptimizationPlan {
    automaticRecovery: string;
    rollback: string;
    recoveryCheckpoints: string;
    resumeProcessing: string;
    versionRecovery: string;
    allRecoveryOptimized: boolean;
}
export interface PerformanceOptimizationPlan {
    generationSpeed: string;
    validationSpeed: string;
    planningSpeed: string;
    resourceScheduling: string;
    queueProcessing: string;
    scalability: string;
    allPerformanceOptimized: boolean;
}
export interface OptimizationDependencyValidationPlan {
    memoryEngine: boolean;
    knowledgeEngine: boolean;
    productIntelligenceEngine: boolean;
    imageIntelligenceEngine: boolean;
    videoIntelligenceEngine: boolean;
    videoGenerationFoundation: boolean;
    storyboardGeneration: boolean;
    sceneGeneration: boolean;
    cameraDirector: boolean;
    motionGeneration: boolean;
    animation: boolean;
    visualEffects: boolean;
    audioSynchronization: boolean;
    marketingVideo: boolean;
    videoProduction: boolean;
    renderingPreparation: boolean;
    videoQualityValidation: boolean;
    allDependenciesReady: boolean;
    missingDependencies: string[];
}
export interface OptimizationScores {
    optimizationScore: number;
    performanceScore: number;
    resourceEfficiencyScore: number;
    qualityImprovementScore: number;
    productionReadinessScore: number;
    aiConfidenceScore: number;
}
export interface OptimizationRelationships {
    storyboards: string[];
    productionPlans: string[];
    renderPlans: string[];
    validationReports: string[];
    products: string[];
    brands: string[];
    campaigns: string[];
    motionPlans: string[];
    cameraPlans: string[];
    animationPlans: string[];
    visualEffectPlans: string[];
    audioPlans: string[];
    marketingPlans: string[];
    knowledgeRecords: string[];
    scenes: string[];
}
export interface VideoGenerationOptimizationInput {
    storyboardId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    validationId?: string;
    renderPlanId?: string;
    productionId?: string;
    knowledgeRecordIds?: string[];
    platform?: StoryboardGenerationPlatform;
}
export interface VideoGenerationOptimizationRecord {
    optimizationId: string;
    profile: OptimizationProfile;
    planType: OptimizationPlanType;
    componentOptimization: ComponentOptimizationPlan;
    pipelineOptimization: PipelineOptimizationPlan;
    resourceOptimization: ResourceOptimizationPlan;
    qualityOptimization: QualityOptimizationPlan;
    searchOptimization: SearchOptimizationPlan;
    recoveryOptimization: RecoveryOptimizationPlan;
    performanceOptimization: PerformanceOptimizationPlan;
    dependencyValidation: OptimizationDependencyValidationPlan;
    scores: OptimizationScores;
    relationships: OptimizationRelationships;
    recommendations: string[];
    validated: boolean;
    approved: boolean;
    brandConsistent: boolean;
    createdAt: string;
    lastUpdated: string;
}
export interface VideoGenerationOptimizationResult {
    success: boolean;
    optimizations?: VideoGenerationOptimizationRecord[];
    record?: VideoGenerationOptimizationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
}
export interface VideoGenerationOptimizationSearchQuery {
    optimizationId?: string;
    storyboardId?: string;
    validationId?: string;
    renderPlanId?: string;
    productionId?: string;
    videoId?: string;
    productId?: string;
    brandId?: string;
    campaignId?: string;
    platform?: StoryboardGenerationPlatform;
    optimization?: string;
    performance?: string;
    keywords?: string;
    text?: string;
    limit?: number;
}
export interface VideoGenerationOptimizationEngineStatusReport {
    engineStatus: string;
    pipelineOptimizationStatus: string;
    resourceOptimizationStatus: string;
    performanceOptimizationStatus: string;
    optimizationsGenerated: number;
    averageOptimizationScore: number;
    averageProductionReadinessScore: number;
    performance: {
        averageOptimizationMs: number;
        averageSearchMs: number;
        averageRepairMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class VideoGenerationOptimizationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare const OPTIMIZATION_PLATFORM_TARGETS: StoryboardGenerationPlatform[];
//# sourceMappingURL=types.d.ts.map