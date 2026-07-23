import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeRetrievalLogger } from "./retrieval-logger.js";
import { KnowledgeRetrievalResponse, KnowledgeRetrievalStatusReport, KnowledgeSearchQuery, KnowledgeSearchResponse } from "./types.js";
/**
 * Knowledge Retrieval Engine — intelligently finds, ranks and delivers stored knowledge.
 */
export declare class AiKnowledgeRetrievalEngine {
    private foundation;
    private storageEngine;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: KnowledgeRetrievalLogger;
    private readonly queryBuilder;
    private readonly usageTracker;
    private readonly cache;
    private ranker;
    private relatedFinder;
    private validator;
    private searchTimes;
    private retrievalTimes;
    private totalSearches;
    private totalRetrievals;
    initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    search(query: KnowledgeSearchQuery): Promise<KnowledgeSearchResponse>;
    retrieve(knowledgeId: string, requesterId?: string): Promise<KnowledgeRetrievalResponse>;
    invalidateCache(knowledgeId?: string): void;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    buildStatusReport(): KnowledgeRetrievalStatusReport;
    private filterByScores;
    private hydrateResult;
    private wasFromCache;
    private ensureReady;
}
//# sourceMappingURL=knowledge-retrieval-engine.d.ts.map