import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { BrandAnalyzer } from "./brand-analyzer.js";
import { BrandLearner } from "./brand-learner.js";
import { BrandKnowledgeLogger } from "./brand-logger.js";
import { BrandRelationshipLinker, BrandRecommender } from "./brand-recommender.js";
import { BrandScorer } from "./brand-scorer.js";
import { BrandRecordStore } from "./brand-stores.js";
import { BrandAnalysisInput, BrandAnalysisRecord, BrandAnalysisResult, BrandSearchQuery } from "./types.js";
export declare class BrandProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly recommender;
    private readonly linker;
    private readonly learner;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, analyzer: BrandAnalyzer, scorer: BrandScorer, recommender: BrandRecommender, linker: BrandRelationshipLinker, learner: BrandLearner, records: BrandRecordStore, logger: BrandKnowledgeLogger);
    analyze(input: BrandAnalysisInput): Promise<BrandAnalysisResult>;
    search(query: BrandSearchQuery): Promise<BrandAnalysisRecord[]>;
    private filterLocal;
    private ensureGraphNode;
    private buildKnowledgeDescription;
}
//# sourceMappingURL=brand-processor.d.ts.map