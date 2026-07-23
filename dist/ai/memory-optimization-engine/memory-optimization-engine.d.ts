import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { ArchiveResult, CacheOptimizationResult, DuplicateGroup, DuplicateMergeResult, IntegrityVerification, MemoryAnalysisReport, MemoryOptimizationStatusReport, MemoryTierAssignment, OptimizationResult, RecoveryPoint } from "./types.js";
/**
 * Memory Optimization Engine — keeps the memory system fast, efficient, and scalable.
 */
export declare class AiMemoryOptimizationEngine {
    private foundation;
    private storageRoot;
    private optimizationDir;
    private initialized;
    private startupComplete;
    readonly logger: MemoryOptimizationLogger;
    private analyzer;
    private tierManager;
    private duplicateMerger;
    private archiveManager;
    private metadataCompressor;
    private cacheOptimizer;
    private recoveryManager;
    private optimizer;
    private optimizationTimes;
    private analysisTimes;
    private totalOptimizations;
    private lastOptimizationMs;
    private lastTierDistribution;
    initialize(foundation: AiMemoryFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeMemory(): Promise<MemoryAnalysisReport>;
    optimize(): Promise<OptimizationResult>;
    archiveInactive(): Promise<ArchiveResult>;
    detectDuplicates(): DuplicateGroup[];
    mergeDuplicates(): Promise<DuplicateMergeResult>;
    optimizeCache(): Promise<CacheOptimizationResult>;
    classifyTiers(): MemoryTierAssignment[];
    getTier(memoryId: string): MemoryTierAssignment | undefined;
    createRecoveryPoint(label: string): RecoveryPoint;
    restoreRecoveryPoint(recoveryPointId: string): boolean;
    listRecoveryPoints(): RecoveryPoint[];
    verifyIntegrity(): Promise<IntegrityVerification>;
    buildStatusReport(): MemoryOptimizationStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private getSnapshotFiles;
    private ensureReady;
}
//# sourceMappingURL=memory-optimization-engine.d.ts.map