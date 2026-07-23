import { MemoryStorageIndexEntry } from "../memory-storage-engine/types.js";
import { MemorySearchQuery } from "./types.js";
export declare class SearchQueryBuilder {
    filterCandidates(entries: MemoryStorageIndexEntry[], query: MemorySearchQuery): MemoryStorageIndexEntry[];
    private applyTypeFilter;
}
//# sourceMappingURL=search-query-builder.d.ts.map