/**
 * KWIZERA AI STUDIO — Knowledge Optimization Engine types (Step 4L)
 */
import { KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
export declare enum KnowledgeTier {
    Core = "core",
    FrequentlyUsed = "frequently-used",
    Creative = "creative",
    Business = "business",
    Industry = "industry",
    Archived = "archived",
    Historical = "historical",
    Experimental = "experimental"
}
export declare enum KnowledgeOptimizationStrategy {
    Classification = "classification",
    Relationship = "relationship",
    Graph = "graph",
    Semantic = "semantic",
    Recommendation = "recommendation",
    Metadata = "metadata",
    Search = "search",
    Index = "index",
    Cache = "cache",
    Deduplication = "deduplication"
}
export interface KnowledgeTierAssignment {
    knowledgeId: string;
    knowledgeType: KnowledgeStorageType;
    tier: KnowledgeTier;
    accessCount: number;
    lastAccessTime: string;
    qualityScore: number;
    confidenceScore: number;
    assignedAt: string;
}
export interface KnowledgeAnalysisReport {
    totalRecords: number;
    totalStorageBytes: number;
    knowledgeGrowthRate: number;
    duplicateGroups: number;
    incompleteRecords: number;
    lowQualityRecords: number;
    fragmentationScore: number;
    indexQualityScore: number;
    relationshipQualityScore: number;
    graphQualityScore: number;
    classificationQualityScore: number;
    averageSearchMs: number;
    averageRetrievalMs: number;
    averageRecommendationMs: number;
    tierDistribution: Record<KnowledgeTier, number>;
    durationMs: number;
}
export interface KnowledgeDuplicateGroup {
    fingerprint: string;
    knowledgeIds: string[];
    primaryId: string;
    conflictScore: number;
}
export interface KnowledgeDuplicateMergeResult {
    merged: number;
    preserved: string[];
    archived: string[];
    durationMs: number;
}
export interface KnowledgeCacheOptimizationResult {
    warmed: number;
    priorityIds: string[];
    durationMs: number;
}
export interface KnowledgeQualityImprovementResult {
    improved: number;
    rejected: number;
    durationMs: number;
}
export interface KnowledgeOptimizationStepResult {
    strategy: KnowledgeOptimizationStrategy;
    success: boolean;
    detail: string;
    durationMs: number;
    itemsAffected: number;
}
export interface KnowledgeOptimizationResult {
    success: boolean;
    recoveryPointId: string;
    steps: KnowledgeOptimizationStepResult[];
    performanceImprovement: {
        searchMsBefore: number;
        searchMsAfter: number;
        retrievalMsBefore: number;
        retrievalMsAfter: number;
        recommendationMsBefore: number;
        recommendationMsAfter: number;
    };
    qualityImprovement: {
        qualityScoreBefore: number;
        qualityScoreAfter: number;
        completenessBefore: number;
        completenessAfter: number;
    };
    storageEfficiency: {
        bytesBefore: number;
        bytesAfter: number;
        metadataOptimized: number;
    };
    durationMs: number;
}
export interface KnowledgeRecoveryPoint {
    recoveryPointId: string;
    createdAt: string;
    label: string;
    recordCount: number;
    edgeCount: number;
    manifestPath: string;
}
export interface KnowledgeIntegrityVerification {
    valid: boolean;
    recordsIntact: boolean;
    indexesValid: boolean;
    relationshipsValid: boolean;
    graphValid: boolean;
    searchQualityMaintained: boolean;
    recommendationQualityMaintained: boolean;
    diagnostics: string[];
}
export interface KnowledgeOptimizationStatusReport {
    engineStatus: string;
    knowledgeOptimizationStatus: string;
    knowledgeQualityImprovement: string;
    relationshipOptimizationStatus: string;
    recommendationPerformance: string;
    graphPerformance: string;
    recoveryStatus: string;
    totalOptimizations: number;
    lastOptimizationMs: number;
    tierDistribution: Record<KnowledgeTier, number>;
    performance: {
        averageOptimizationMs: number;
        averageAnalysisMs: number;
        lastSearchMs: number;
        lastRetrievalMs: number;
        lastRecommendationMs: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class KnowledgeOptimizationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map