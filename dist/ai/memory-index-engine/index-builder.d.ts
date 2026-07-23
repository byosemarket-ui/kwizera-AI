import type { MemoryRecord } from "../memory-storage-engine/types.js";
import { InvertedIndexStore } from "./inverted-index-store.js";
import { RelationshipIndex } from "./relationship-index.js";
import { MemoryIndexLogger } from "./index-logger.js";
export declare class IndexBuilder {
    private readonly invertedStore;
    private readonly relationshipIndex;
    private readonly logger;
    constructor(invertedStore: InvertedIndexStore, relationshipIndex: RelationshipIndex, logger: MemoryIndexLogger);
    indexRecord(record: MemoryRecord, allMemoryIds: string[]): number;
    removeFromIndexes(memoryId: string): void;
    private indexByMemoryType;
}
//# sourceMappingURL=index-builder.d.ts.map