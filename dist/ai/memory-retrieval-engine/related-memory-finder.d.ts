import type { MemoryRecord } from "../memory-storage-engine/types.js";
import { MemoryStorageIndexEntry } from "../memory-storage-engine/types.js";
import { RankedMemoryResult } from "./types.js";
import { ResultRanker } from "./result-ranker.js";
import { MemoryRetrievalLogger } from "./retrieval-logger.js";
export declare class RelatedMemoryFinder {
    private readonly ranker;
    private readonly logger;
    constructor(ranker: ResultRanker, logger: MemoryRetrievalLogger);
    findRelated(source: MemoryRecord, allEntries: MemoryStorageIndexEntry[], limit?: number): RankedMemoryResult[];
    recommend(context: {
        text?: string;
        project?: string;
        workflow?: string;
    }, allEntries: MemoryStorageIndexEntry[], excludeIds?: string[], limit?: number): RankedMemoryResult[];
    private computeStrength;
    private computeRecommendationScore;
    private getTypeRelationStrength;
    categorizeRelated(source: MemoryRecord, related: RankedMemoryResult[]): Record<string, string[]>;
}
export declare function isRecordRetrievable(record: MemoryRecord): boolean;
//# sourceMappingURL=related-memory-finder.d.ts.map