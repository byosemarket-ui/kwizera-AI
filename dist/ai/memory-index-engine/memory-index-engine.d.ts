import type { MemoryRecord } from "../memory-storage-engine/types.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryIndexLogger } from "./index-logger.js";
import { IndexHealthReport, IndexLookupQuery, IndexLookupResult, IndexRebuildResult, MemoryIndexStatusReport } from "./types.js";
/**
 * Memory Index Engine — organizes stored memory into intelligent indexes for fast retrieval.
 */
export declare class AiMemoryIndexEngine {
    private foundation;
    private storageEngine;
    private storageRoot;
    private initialized;
    private startupComplete;
    private lastHealth;
    readonly logger: MemoryIndexLogger;
    private readonly invertedStore;
    private readonly relationshipIndex;
    private indexBuilder;
    private indexLookup;
    private healthChecker;
    private rebuilder;
    private optimizer;
    private indexTimes;
    private lookupTimes;
    private totalIndexed;
    initialize(foundation: AiMemoryFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    onRecordStored(record: MemoryRecord): void;
    onRecordUpdated(record: MemoryRecord): void;
    onRecordRemoved(memoryId: string): void;
    indexRecord(record: MemoryRecord): number;
    lookup(query: IndexLookupQuery): IndexLookupResult;
    getRelated(memoryId: string): string[];
    runHealthCheck(): Promise<IndexHealthReport>;
    rebuildIndexes(): Promise<IndexRebuildResult>;
    optimizeIndexes(): void;
    totalIndexedRecords(): number;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    buildStatusReport(): MemoryIndexStatusReport;
    private writeManifest;
    private ensureReady;
}
//# sourceMappingURL=memory-index-engine.d.ts.map