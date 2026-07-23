import { KnowledgeStorageIndexEntry } from "../knowledge-storage-engine/types.js";
import { KnowledgeSearchQuery } from "./types.js";
export declare class KnowledgeSearchQueryBuilder {
    filterCandidates(entries: KnowledgeStorageIndexEntry[], query: KnowledgeSearchQuery): KnowledgeStorageIndexEntry[];
    computeSemanticScore(query: string, searchableText: string): number;
    private applyContextFilter;
    private applyTypeFilter;
    private tokenize;
    private importanceWeight;
}
//# sourceMappingURL=search-query-builder.d.ts.map