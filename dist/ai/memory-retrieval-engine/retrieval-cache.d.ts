import type { MemoryRecord } from "../memory-storage-engine/types.js";
import type { MemoryStorageIndexEntry } from "../memory-storage-engine/types.js";
import { MemoryRetrievalLogger } from "./retrieval-logger.js";
export declare class RetrievalCache {
    private readonly logger;
    private cache;
    private hits;
    private misses;
    constructor(logger: MemoryRetrievalLogger);
    get(memoryId: string, indexEntry?: MemoryStorageIndexEntry): MemoryRecord | null;
    set(memoryId: string, record: MemoryRecord, indexEntry?: MemoryStorageIndexEntry): void;
    invalidate(memoryId: string): void;
    clear(): void;
    getStats(): {
        size: number;
        hits: number;
        misses: number;
        hitRate: number;
    };
}
//# sourceMappingURL=retrieval-cache.d.ts.map