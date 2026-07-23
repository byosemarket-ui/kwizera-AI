import { UsageStat } from "./types.js";
import { MemoryRetrievalLogger } from "./retrieval-logger.js";
export declare class UsageTracker {
    private readonly logger;
    private statsPath;
    private stats;
    constructor(logger: MemoryRetrievalLogger);
    initialize(retrievalDir: string): void;
    recordAccess(memoryId: string): UsageStat;
    getStat(memoryId: string): UsageStat;
    getAllStats(): UsageStat[];
    private persist;
}
//# sourceMappingURL=usage-tracker.d.ts.map