import { IndexLookupQuery, IndexType } from "./types.js";
import { InvertedIndexStore } from "./inverted-index-store.js";
import { RelationshipIndex } from "./relationship-index.js";
export declare class IndexLookup {
    private readonly invertedStore;
    private readonly relationshipIndex;
    constructor(invertedStore: InvertedIndexStore, relationshipIndex: RelationshipIndex);
    lookup(query: IndexLookupQuery): {
        memoryIds: string[];
        indexTypesUsed: IndexType[];
    };
    private unique;
    private union;
    private intersect;
}
//# sourceMappingURL=index-lookup.d.ts.map