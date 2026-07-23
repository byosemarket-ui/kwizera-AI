/**
 * KWIZERA AI STUDIO — Memory Optimization Engine types (Step 3K)
 */
import { MemoryStorageType } from "../memory-storage-engine/types.js";
export declare enum MemoryTier {
    Active = "active",
    FrequentlyUsed = "frequently-used",
    Learning = "learning",
    Archived = "archived",
    Historical = "historical",
    System = "system"
}
export declare enum OptimizationStrategy {
    Index = "index",
    Relationship = "relationship",
    Storage = "storage",
    Metadata = "metadata",
    Search = "search",
    Cache = "cache",
    Archive = "archive",
    Deduplication = "deduplication"
}
export interface MemoryTierAssignment {
    memoryId: string;
    memoryType: MemoryStorageType;
    tier: MemoryTier;
    accessCount: number;
    lastAccessTime: string;
    assignedAt: string;
}
export interface MemoryAnalysisReport {
    totalRecords: number;
    totalStorageBytes: number;
    duplicateGroups: number;
    fragmentationScore: number;
    indexQualityScore: number;
    relationshipQualityScore: number;
    averageSearchMs: number;
    averageRetrievalMs: number;
    tierDistribution: Record<MemoryTier, number>;
    durationMs: number;
}
export interface DuplicateGroup {
    fingerprint: string;
    memoryIds: string[];
    primaryId: string;
    learningValue: number;
}
export interface DuplicateMergeResult {
    merged: number;
    preserved: string[];
    archived: string[];
    durationMs: number;
}
export interface ArchiveResult {
    archived: number;
    memoryIds: string[];
    durationMs: number;
}
export interface CacheOptimizationResult {
    warmed: number;
    priorityIds: string[];
    durationMs: number;
}
export interface OptimizationStepResult {
    strategy: OptimizationStrategy;
    success: boolean;
    detail: string;
    durationMs: number;
    itemsAffected: number;
}
export interface OptimizationResult {
    success: boolean;
    recoveryPointId: string;
    steps: OptimizationStepResult[];
    performanceImprovement: {
        searchMsBefore: number;
        searchMsAfter: number;
        retrievalMsBefore: number;
        retrievalMsAfter: number;
    };
    storageEfficiency: {
        bytesBefore: number;
        bytesAfter: number;
        metadataCompressed: number;
    };
    durationMs: number;
}
export interface RecoveryPoint {
    recoveryPointId: string;
    createdAt: string;
    label: string;
    recordCount: number;
    edgeCount: number;
    manifestPath: string;
}
export interface IntegrityVerification {
    valid: boolean;
    recordsIntact: boolean;
    indexesValid: boolean;
    relationshipsValid: boolean;
    searchQualityMaintained: boolean;
    diagnostics: string[];
}
export interface MemoryOptimizationStatusReport {
    engineStatus: string;
    performanceImprovement: string;
    storageEfficiency: string;
    integrityStatus: string;
    recoveryStatus: string;
    totalOptimizations: number;
    lastOptimizationMs: number;
    tierDistribution: Record<MemoryTier, number>;
    performance: {
        averageOptimizationMs: number;
        averageAnalysisMs: number;
        lastSearchMs: number;
        lastRetrievalMs: number;
        memoryUsageEstimateMb: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class MemoryOptimizationEngineError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
//# sourceMappingURL=types.d.ts.map