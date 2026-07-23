import { MemoryStorageIndexEntry } from "../memory-storage-engine/types.js";
import { MemorySearchQuery, RankedMemoryResult } from "./types.js";
import { UsageTracker } from "./usage-tracker.js";
export declare class ResultRanker {
    private readonly usageTracker;
    constructor(usageTracker: UsageTracker);
    rank(entries: MemoryStorageIndexEntry[], query: MemorySearchQuery, relatedToId?: string): RankedMemoryResult[];
    private computeFactors;
    private computeRelevance;
    private estimateQuality;
    private computeLearningImportance;
    private computeRelationshipStrength;
    private computeRecencyBonus;
}
//# sourceMappingURL=result-ranker.d.ts.map