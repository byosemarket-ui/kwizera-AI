import type { KnowledgeRecord } from "../knowledge-storage-engine/types.js";
import { KnowledgeStorageIndexEntry } from "../knowledge-storage-engine/types.js";
import { RankedKnowledgeResult, RelatedKnowledgeGroups } from "./types.js";
import { KnowledgeResultRanker } from "./result-ranker.js";
import { KnowledgeRetrievalLogger } from "./retrieval-logger.js";
export declare class RelatedKnowledgeFinder {
    private readonly ranker;
    private readonly logger;
    constructor(ranker: KnowledgeResultRanker, logger: KnowledgeRetrievalLogger);
    findRelated(source: KnowledgeRecord, allEntries: KnowledgeStorageIndexEntry[], limit?: number): RankedKnowledgeResult[];
    recommend(context: {
        text?: string;
        objective?: string;
        domain?: string;
        workflow?: string;
    }, allEntries: KnowledgeStorageIndexEntry[], excludeIds?: string[], limit?: number): RankedKnowledgeResult[];
    categorizeRelated(source: KnowledgeRecord, related: RankedKnowledgeResult[]): RelatedKnowledgeGroups;
    private computeStrength;
    private computeRecommendationScore;
    private getTypeRelationStrength;
}
//# sourceMappingURL=related-knowledge-finder.d.ts.map