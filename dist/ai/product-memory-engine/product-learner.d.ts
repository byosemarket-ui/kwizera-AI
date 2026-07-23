import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { ProductMemoryLogger } from "./product-logger.js";
import { ProductLearningResult, ProductRecord } from "./types.js";
export declare class ProductLearner {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, logger: ProductMemoryLogger);
    learnFromCompletedProject(product: ProductRecord, patternsStored: number): Promise<ProductLearningResult>;
    private extractLessons;
    private buildRecommendations;
    private buildDescription;
}
//# sourceMappingURL=product-learner.d.ts.map