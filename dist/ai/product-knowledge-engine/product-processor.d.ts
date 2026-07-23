import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { ProductAnalyzer } from "./product-analyzer.js";
import { ProductLearner } from "./product-learner.js";
import { ProductKnowledgeLogger } from "./product-logger.js";
import { ProductRelationshipLinker, ProductRecommender } from "./product-recommender.js";
import { ProductScorer } from "./product-scorer.js";
import { ProductRecordStore } from "./product-stores.js";
import { ProductAnalysisInput, ProductAnalysisRecord, ProductAnalysisResult, ProductSearchQuery } from "./types.js";
export declare class ProductProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly recommender;
    private readonly linker;
    private readonly learner;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiKnowledgeFoundation, analyzer: ProductAnalyzer, scorer: ProductScorer, recommender: ProductRecommender, linker: ProductRelationshipLinker, learner: ProductLearner, records: ProductRecordStore, logger: ProductKnowledgeLogger);
    analyze(input: ProductAnalysisInput): Promise<ProductAnalysisResult>;
    search(query: ProductSearchQuery): Promise<ProductAnalysisRecord[]>;
    private filterLocal;
    private ensureGraphNode;
    private buildKnowledgeDescription;
}
//# sourceMappingURL=product-processor.d.ts.map