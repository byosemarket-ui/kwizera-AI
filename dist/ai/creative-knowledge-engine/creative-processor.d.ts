import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { CreativeAnalyzer } from "./creative-analyzer.js";
import { CreativeLearner } from "./creative-learner.js";
import { CreativeKnowledgeLogger } from "./creative-logger.js";
import { CreativeRelationshipLinker, CreativeRecommender } from "./creative-recommender.js";
import { CreativeScorer } from "./creative-scorer.js";
import { CreativeRecordStore } from "./creative-stores.js";
import { CreativeAnalysisInput, CreativeAnalysisRecord, CreativeAnalysisResult, CreativeSearchQuery } from "./types.js";
export declare class CreativeProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly recommender;
    private readonly linker;
    private readonly learner;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, analyzer: CreativeAnalyzer, scorer: CreativeScorer, recommender: CreativeRecommender, linker: CreativeRelationshipLinker, learner: CreativeLearner, records: CreativeRecordStore, logger: CreativeKnowledgeLogger);
    analyze(input: CreativeAnalysisInput): Promise<CreativeAnalysisResult>;
    search(query: CreativeSearchQuery): Promise<CreativeAnalysisRecord[]>;
    private filterLocal;
    private ensureGraphNode;
    private buildKnowledgeDescription;
}
//# sourceMappingURL=creative-processor.d.ts.map