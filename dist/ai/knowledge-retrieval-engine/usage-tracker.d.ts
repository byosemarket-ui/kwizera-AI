import { KnowledgeUsageStat } from "./types.js";
import { KnowledgeRetrievalLogger } from "./retrieval-logger.js";
export declare class KnowledgeUsageTracker {
    private readonly logger;
    private statsPath;
    private stats;
    constructor(logger: KnowledgeRetrievalLogger);
    initialize(retrievalDir: string): void;
    recordAccess(knowledgeId: string): KnowledgeUsageStat;
    getStat(knowledgeId: string): KnowledgeUsageStat;
    getAllStats(): KnowledgeUsageStat[];
    private persist;
}
//# sourceMappingURL=usage-tracker.d.ts.map