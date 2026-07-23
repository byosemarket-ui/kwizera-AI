import { KnowledgeStorageIndexEntry } from "../knowledge-storage-engine/types.js";
import { KnowledgeSearchQuery, RankedKnowledgeResult } from "./types.js";
import { KnowledgeUsageTracker } from "./usage-tracker.js";
export declare class KnowledgeResultRanker {
    private readonly usageTracker;
    private readonly queryBuilder;
    constructor(usageTracker: KnowledgeUsageTracker);
    rank(entries: KnowledgeStorageIndexEntry[], query: KnowledgeSearchQuery, relatedToId?: string): RankedKnowledgeResult[];
    private computeFactors;
    private computeRelevance;
    private estimateQuality;
    private estimateConfidence;
    private estimateSourceReliability;
    private computeLearningImportance;
    private computeRelationshipStrength;
    private computeRecencyScore;
    private computeBusinessRelevance;
    private importanceBonus;
}
//# sourceMappingURL=result-ranker.d.ts.map