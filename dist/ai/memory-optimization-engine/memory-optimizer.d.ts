import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { ArchiveManager } from "./archive-manager.js";
import { CacheOptimizer } from "./cache-optimizer.js";
import { DuplicateMerger } from "./duplicate-merger.js";
import { MemoryAnalyzer } from "./memory-analyzer.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryTierManager } from "./memory-tier-manager.js";
import { MetadataCompressor } from "./metadata-compressor.js";
import { RecoveryPointManager } from "./recovery-point-manager.js";
import { IntegrityVerification, OptimizationResult } from "./types.js";
export declare class MemoryOptimizer {
    private readonly foundation;
    private readonly analyzer;
    private readonly tierManager;
    private readonly duplicateMerger;
    private readonly archiveManager;
    private readonly metadataCompressor;
    private readonly cacheOptimizer;
    private readonly recoveryManager;
    private readonly logger;
    private readonly snapshotFiles;
    constructor(foundation: AiMemoryFoundation, analyzer: MemoryAnalyzer, tierManager: MemoryTierManager, duplicateMerger: DuplicateMerger, archiveManager: ArchiveManager, metadataCompressor: MetadataCompressor, cacheOptimizer: CacheOptimizer, recoveryManager: RecoveryPointManager, logger: MemoryOptimizationLogger, snapshotFiles: () => string[]);
    runFullOptimization(): Promise<OptimizationResult>;
    verifyIntegrity(): Promise<IntegrityVerification>;
    private runStep;
    private restoreFromRecovery;
}
//# sourceMappingURL=memory-optimizer.d.ts.map