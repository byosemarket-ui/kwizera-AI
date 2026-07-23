import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryTierManager } from "./memory-tier-manager.js";
import { CacheOptimizationResult } from "./types.js";
export declare class CacheOptimizer {
    private readonly foundation;
    private readonly tierManager;
    private readonly logger;
    private priorityPath;
    constructor(foundation: AiMemoryFoundation, tierManager: MemoryTierManager, logger: MemoryOptimizationLogger);
    initialize(optimizationDir: string): void;
    optimize(): Promise<CacheOptimizationResult>;
    getPriorityPath(): string;
}
//# sourceMappingURL=cache-optimizer.d.ts.map