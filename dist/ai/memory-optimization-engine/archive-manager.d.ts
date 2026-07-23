import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryTierManager } from "./memory-tier-manager.js";
import { ArchiveResult } from "./types.js";
export declare class ArchiveManager {
    private readonly foundation;
    private readonly tierManager;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, tierManager: MemoryTierManager, logger: MemoryOptimizationLogger);
    archiveInactive(): Promise<ArchiveResult>;
    private daysSince;
}
//# sourceMappingURL=archive-manager.d.ts.map