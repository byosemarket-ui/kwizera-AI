import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeAnalysisReport, KnowledgeCacheOptimizationResult, KnowledgeDuplicateGroup, KnowledgeDuplicateMergeResult, KnowledgeIntegrityVerification, KnowledgeOptimizationResult, KnowledgeOptimizationStatusReport, KnowledgeRecoveryPoint, KnowledgeTierAssignment } from "./types.js";
/**
 * Knowledge Optimization Engine — continuously improves knowledge quality, organization, and performance.
 */
export declare class AiKnowledgeOptimizationEngine {
    private foundation;
    private storageRoot;
    private optimizationDir;
    private initialized;
    private startupComplete;
    readonly logger: KnowledgeOptimizationLogger;
    private analyzer;
    private tierManager;
    private deduplicator;
    private metadataOptimizer;
    private qualityImprover;
    private cacheOptimizer;
    private recoveryManager;
    private optimizer;
    private optimizationTimes;
    private analysisTimes;
    private totalOptimizations;
    private lastOptimizationMs;
    private lastTierDistribution;
    initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeKnowledge(): Promise<KnowledgeAnalysisReport>;
    runOptimization(): Promise<KnowledgeOptimizationResult>;
    detectDuplicates(): KnowledgeDuplicateGroup[];
    mergeDuplicates(): Promise<KnowledgeDuplicateMergeResult>;
    optimizeCache(): Promise<KnowledgeCacheOptimizationResult>;
    classifyTiers(): KnowledgeTierAssignment[];
    getTier(knowledgeId: string): KnowledgeTierAssignment | undefined;
    createRecoveryPoint(label: string): KnowledgeRecoveryPoint;
    restoreRecoveryPoint(recoveryPointId: string): boolean;
    listRecoveryPoints(): KnowledgeRecoveryPoint[];
    verifyIntegrity(): Promise<KnowledgeIntegrityVerification>;
    buildStatusReport(): KnowledgeOptimizationStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private getSnapshotFiles;
    private ensureReady;
}
//# sourceMappingURL=knowledge-optimization-engine.d.ts.map