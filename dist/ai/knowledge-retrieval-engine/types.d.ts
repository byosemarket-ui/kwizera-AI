/**
 * KWIZERA AI STUDIO — Knowledge Retrieval Engine types (Step 4C)
 */
import type { KnowledgeRecord, KnowledgeStorageType } from "../knowledge-storage-engine/types.js";
export declare enum KnowledgeSearchMode {
    Exact = "exact",
    Semantic = "semantic",
    Keyword = "keyword",
    Category = "category",
    Relationship = "relationship",
    Hybrid = "hybrid",
    Context = "context",
    Priority = "priority",
    Recommendation = "recommendation"
}
export interface KnowledgeSearchContext {
    objective?: string;
    taskType?: string;
    domain?: string;
    projectId?: string;
    workflowId?: string;
}
export interface KnowledgeSearchQuery {
    mode?: KnowledgeSearchMode;
    knowledgeId?: string;
    knowledgeType?: KnowledgeStorageType;
    category?: string;
    topic?: string;
    product?: string;
    brand?: string;
    image?: string;
    video?: string;
    marketing?: string;
    language?: string;
    workflow?: string;
    decision?: string;
    reasoning?: string;
    tags?: string[];
    keywords?: string[];
    text?: string;
    source?: string;
    minQualityScore?: number;
    minConfidenceScore?: number;
    relatedTo?: string;
    context?: KnowledgeSearchContext;
    limit?: number;
    requesterId?: string;
}
export interface KnowledgeRankingFactors {
    relevanceScore: number;
    qualityScore: number;
    confidenceScore: number;
    sourceReliability: number;
    relationshipStrength: number;
    learningImportance: number;
    usageFrequency: number;
    recencyScore: number;
    businessRelevance: number;
    compositeScore: number;
}
export interface RankedKnowledgeResult {
    knowledgeId: string;
    knowledgeType: KnowledgeStorageType;
    title: string;
    category: string;
    topic: string;
    record?: KnowledgeRecord;
    ranking: KnowledgeRankingFactors;
    rank: number;
}
export interface RelatedKnowledgeGroups {
    relatedKnowledge: string[];
    relatedMemory: string[];
    relatedProjects: string[];
    relatedProducts: string[];
    relatedVideos: string[];
    relatedMarketing: string[];
    relatedDecisions: string[];
    relatedLearning: string[];
    relatedWorkflows: string[];
}
export interface KnowledgeSearchResponse {
    success: boolean;
    mode: KnowledgeSearchMode;
    results: RankedKnowledgeResult[];
    relatedKnowledge: RankedKnowledgeResult[];
    recommendations: RankedKnowledgeResult[];
    relatedGroups: RelatedKnowledgeGroups;
    searchMs: number;
    retrievalMs: number;
    totalCandidates: number;
    fromCache: boolean;
    diagnostics: string[];
}
export interface KnowledgeRetrievalResponse {
    success: boolean;
    knowledgeId: string;
    record?: KnowledgeRecord;
    relatedKnowledge: RankedKnowledgeResult[];
    recommendations: RankedKnowledgeResult[];
    relatedGroups: RelatedKnowledgeGroups;
    retrievalMs: number;
    fromCache: boolean;
    diagnostics: string[];
    recoverySuggestion?: string;
}
export interface KnowledgeUsageStat {
    knowledgeId: string;
    accessCount: number;
    lastAccessTime: string;
}
export interface KnowledgeCacheStats {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
}
export interface KnowledgeRetrievalStatusReport {
    engineStatus: string;
    searchPerformance: {
        averageSearchMs: number;
        averageRetrievalMs: number;
        lastSearchMs: number;
        lastRetrievalMs: number;
    };
    rankingQuality: string;
    recommendationQuality: string;
    cacheStatus: KnowledgeCacheStats;
    validationStatus: string;
    totalSearches: number;
    totalRetrievals: number;
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class KnowledgeRetrievalEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map