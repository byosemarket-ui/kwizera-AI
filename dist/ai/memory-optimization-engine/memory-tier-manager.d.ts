import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryTier, MemoryTierAssignment } from "./types.js";
export declare class MemoryTierManager {
    private readonly foundation;
    private readonly storageRoot;
    private readonly logger;
    private tiersPath;
    private assignments;
    constructor(foundation: AiMemoryFoundation, storageRoot: string, logger: MemoryOptimizationLogger);
    initialize(optimizationDir: string): void;
    classifyAll(): MemoryTierAssignment[];
    getTier(memoryId: string): MemoryTierAssignment | undefined;
    getByTier(tier: MemoryTier): MemoryTierAssignment[];
    getDistribution(): Record<MemoryTier, number>;
    markArchived(memoryId: string): void;
    getTiersPath(): string;
    private loadUsageStats;
    private daysSince;
    private persist;
}
//# sourceMappingURL=memory-tier-manager.d.ts.map