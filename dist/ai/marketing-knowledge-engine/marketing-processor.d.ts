import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { MarketingAnalyzer } from "./marketing-analyzer.js";
import { MarketingLearner } from "./marketing-learner.js";
import { MarketingKnowledgeLogger } from "./marketing-logger.js";
import { MarketingRelationshipLinker, MarketingRecommender } from "./marketing-recommender.js";
import { MarketingScorer } from "./marketing-scorer.js";
import { MarketingRecordStore } from "./marketing-stores.js";
import { MarketingAnalysisInput, MarketingAnalysisRecord, MarketingAnalysisResult, MarketingSearchQuery } from "./types.js";
export declare class MarketingProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly recommender;
    private readonly linker;
    private readonly learner;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, analyzer: MarketingAnalyzer, scorer: MarketingScorer, recommender: MarketingRecommender, linker: MarketingRelationshipLinker, learner: MarketingLearner, records: MarketingRecordStore, logger: MarketingKnowledgeLogger);
    analyze(input: MarketingAnalysisInput): Promise<MarketingAnalysisResult>;
    search(query: MarketingSearchQuery): Promise<MarketingAnalysisRecord[]>;
    private filterLocal;
    private ensureGraphNode;
    private buildKnowledgeDescription;
}
//# sourceMappingURL=marketing-processor.d.ts.map