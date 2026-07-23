import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryRetrievalLogger } from "./retrieval-logger.js";
import { MemoryRetrievalResponse, MemoryRetrievalStatusReport, MemorySearchQuery, MemorySearchResponse } from "./types.js";
/**
 * Memory Retrieval Engine — intelligently finds, retrieves and delivers stored memory.
 */
export declare class AiMemoryRetrievalEngine {
    private foundation;
    private storageEngine;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: MemoryRetrievalLogger;
    private readonly queryBuilder;
    private readonly usageTracker;
    private readonly cache;
    private ranker;
    private relatedFinder;
    private validator;
    private indexEngine;
    private searchTimes;
    private retrievalTimes;
    private totalSearches;
    private totalRetrievals;
    initialize(foundation: AiMemoryFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    search(query: MemorySearchQuery): Promise<MemorySearchResponse>;
    retrieve(memoryId: string, requesterId?: string): Promise<MemoryRetrievalResponse>;
    invalidateCache(memoryId?: string): void;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    buildStatusReport(): MemoryRetrievalStatusReport;
    private hydrateResult;
    private wasFromCache;
    private ensureReady;
}
//# sourceMappingURL=memory-retrieval-engine.d.ts.map