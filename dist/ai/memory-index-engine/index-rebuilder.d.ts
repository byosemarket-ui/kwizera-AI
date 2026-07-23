import type { AiMemoryStorageEngine } from "../memory-storage-engine/memory-storage-engine.js";
import { IndexRebuildResult } from "./types.js";
import { IndexBuilder } from "./index-builder.js";
import { InvertedIndexStore } from "./inverted-index-store.js";
import { RelationshipIndex } from "./relationship-index.js";
import { MemoryIndexLogger } from "./index-logger.js";
export declare class IndexRebuilder {
    private readonly invertedStore;
    private readonly relationshipIndex;
    private readonly indexBuilder;
    private readonly logger;
    constructor(invertedStore: InvertedIndexStore, relationshipIndex: RelationshipIndex, indexBuilder: IndexBuilder, logger: MemoryIndexLogger);
    rebuild(storageEngine: AiMemoryStorageEngine): Promise<IndexRebuildResult>;
}
//# sourceMappingURL=index-rebuilder.d.ts.map