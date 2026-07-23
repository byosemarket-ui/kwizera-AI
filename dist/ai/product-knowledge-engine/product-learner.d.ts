import { ProductAnalysisRecord, ProductKnowledgeLearningPattern } from "./types.js";
import { ProductPatternStore } from "./product-stores.js";
import { ProductKnowledgeLogger } from "./product-logger.js";
export declare class ProductLearner {
    private readonly patterns;
    private readonly logger;
    constructor(patterns: ProductPatternStore, logger: ProductKnowledgeLogger);
    learnFromAnalysis(record: ProductAnalysisRecord): ProductKnowledgeLearningPattern[];
    private createPattern;
}
//# sourceMappingURL=product-learner.d.ts.map