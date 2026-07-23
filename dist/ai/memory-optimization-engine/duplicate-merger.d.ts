import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryTierManager } from "./memory-tier-manager.js";
import { DuplicateGroup, DuplicateMergeResult } from "./types.js";
export declare class DuplicateMerger {
    private readonly foundation;
    private readonly tierManager;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, tierManager: MemoryTierManager, logger: MemoryOptimizationLogger);
    detectDuplicates(): DuplicateGroup[];
    mergeDuplicates(): Promise<DuplicateMergeResult>;
}
//# sourceMappingURL=duplicate-merger.d.ts.map