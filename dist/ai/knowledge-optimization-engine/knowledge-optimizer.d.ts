import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeAnalyzer } from "./knowledge-analyzer.js";
import { KnowledgeCacheOptimizer } from "./knowledge-cache-optimizer.js";
import { KnowledgeDeduplicator } from "./knowledge-deduplicator.js";
import { KnowledgeMetadataOptimizer } from "./knowledge-metadata-optimizer.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeQualityImprover } from "./knowledge-quality-improver.js";
import { KnowledgeTierManager } from "./knowledge-tier-manager.js";
import { KnowledgeRecoveryPointManager } from "./recovery-point-manager.js";
import { KnowledgeIntegrityVerification, KnowledgeOptimizationResult } from "./types.js";
export declare class KnowledgeOptimizer {
    private readonly foundation;
    private readonly analyzer;
    private readonly tierManager;
    private readonly deduplicator;
    private readonly metadataOptimizer;
    private readonly qualityImprover;
    private readonly cacheOptimizer;
    private readonly recoveryManager;
    private readonly logger;
    private readonly snapshotFiles;
    constructor(foundation: AiKnowledgeFoundation, analyzer: KnowledgeAnalyzer, tierManager: KnowledgeTierManager, deduplicator: KnowledgeDeduplicator, metadataOptimizer: KnowledgeMetadataOptimizer, qualityImprover: KnowledgeQualityImprover, cacheOptimizer: KnowledgeCacheOptimizer, recoveryManager: KnowledgeRecoveryPointManager, logger: KnowledgeOptimizationLogger, snapshotFiles: () => string[]);
    runFullOptimization(): Promise<KnowledgeOptimizationResult>;
    verifyIntegrity(): Promise<KnowledgeIntegrityVerification>;
    private runStep;
    private restoreFromRecovery;
}
//# sourceMappingURL=knowledge-optimizer.d.ts.map