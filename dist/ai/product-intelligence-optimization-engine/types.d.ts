/**
 * KWIZERA AI STUDIO — Product Intelligence Optimization Engine types (Step 5M)
 */
import type { CreativePlatform } from "../creative-direction-engine/types.js";
import type { MarketingObjective } from "../marketing-strategy-intelligence-engine/types.js";
export type OptimizationStrategyType = "relationship" | "classification" | "search" | "knowledge-retrieval" | "recommendation" | "planning" | "workflow" | "performance" | "cache" | "metadata";
export interface OptimizationProfile {
    optimizationId: string;
    projectId: string;
    productId: string;
    product: string;
    brand: string;
    campaign: MarketingObjective;
    platform: CreativePlatform;
    optimizationVersion: number;
}
export interface ModuleOptimizationResult {
    moduleId: string;
    moduleName: string;
    qualityScoreBefore: number;
    qualityScoreAfter: number;
    improved: boolean;
    strategiesApplied: OptimizationStrategyType[];
    detail: string;
}
export interface OptimizationStrategies {
    relationshipOptimization: string;
    classificationOptimization: string;
    searchOptimization: string;
    knowledgeRetrievalOptimization: string;
    recommendationOptimization: string;
    planningOptimization: string;
    workflowOptimization: string;
    performanceOptimization: string;
    cacheOptimization: string;
    metadataOptimization: string;
}
export interface CacheOptimization {
    products: string[];
    brands: string[];
    creativeStyles: string[];
    campaignTypes: string[];
    audienceProfiles: string[];
    storyboards: string[];
    visualPlans: string[];
    audioPlans: string[];
    hitRate: number;
}
export interface ProductIntelligenceRecoveryPoint {
    recoveryId: string;
    optimizationId: string;
    createdAt: string;
    baselineMetrics: Record<string, number>;
    cacheSnapshot: CacheOptimization;
    restored: boolean;
}
export interface PerformanceMetrics {
    planningSpeedMs: number;
    searchSpeedMs: number;
    relationshipDetectionMs: number;
    recommendationSpeedMs: number;
    planningSpeedBeforeMs: number;
    searchSpeedBeforeMs: number;
    memoryEstimateMb: number;
    diskUsageEstimateKb: number;
}
export interface OptimizationScores {
    overallImprovementScore: number;
    planningImprovementScore: number;
    searchImprovementScore: number;
    recommendationImprovementScore: number;
    relationshipImprovementScore: number;
    workflowEfficiencyScore: number;
    confidenceImprovementScore: number;
    aiConfidenceScore: number;
}
export interface OptimizationRelationships {
    storyboards: string[];
    scriptPlans: string[];
    visualPlans: string[];
    audioPlans: string[];
    productionPlans: string[];
    qualityPredictions: string[];
    knowledgeRecords: string[];
}
export type ProductIntelligenceOptimizationRelationships = OptimizationRelationships;
export interface ProductIntelligenceOptimizationInput {
    productId: string;
    optimizationId?: string;
    projectId?: string;
}
export interface ProductIntelligenceOptimizationRecord {
    optimizationId: string;
    productId: string;
    projectId: string;
    qualityPredictionId: string;
    productionPlanId: string;
    profile: OptimizationProfile;
    moduleResults: ModuleOptimizationResult[];
    strategies: OptimizationStrategies;
    cache: CacheOptimization;
    performance: PerformanceMetrics;
    scores: OptimizationScores;
    relationships: OptimizationRelationships;
    recoveryPointId: string;
    validated: boolean;
    productionReady: boolean;
    createdAt: string;
    lastUpdated: string;
    version: number;
}
export interface ProductIntelligenceOptimizationResult {
    success: boolean;
    record?: ProductIntelligenceOptimizationRecord;
    durationMs: number;
    diagnostics: string[];
    message?: string;
    recovered?: boolean;
}
export interface ProductIntelligenceOptimizationSearchQuery {
    optimizationId?: string;
    productId?: string;
    brand?: string;
    platform?: CreativePlatform;
    campaign?: MarketingObjective;
    minImprovementScore?: number;
    text?: string;
    limit?: number;
}
export interface ProductIntelligenceOptimizationEngineStatusReport {
    engineStatus: string;
    optimizationStatus: string;
    cacheStatus: string;
    recoveryStatus: string;
    optimizationsCompleted: number;
    averageImprovementScore: number;
    averagePlanningImprovement: number;
    performance: {
        averageOptimizationMs: number;
        averageSearchMs: number;
        averageRecoveryMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ProductIntelligenceOptimizationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map