import type { MemoryRecord } from "../memory-storage-engine/types.js";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { ProductHistoryStore } from "./product-history-store.js";
import { ProductLearner } from "./product-learner.js";
import { ProductMemoryLogger } from "./product-logger.js";
import { ProductPatternDetector } from "./product-pattern-detector.js";
import { ProductPreferenceStore } from "./product-preference-store.js";
import { ProductRelationshipLinker } from "./product-relationship-linker.js";
import { ProductScorer } from "./product-scorer.js";
import { ProductCreateInput, ProductLearningResult, ProductProcessResult, ProductRecord, ProductUpdateInput } from "./types.js";
export declare function recordFromMemory(record: MemoryRecord): ProductRecord;
export declare class ProductProcessor {
    private readonly foundation;
    private readonly history;
    private readonly preferenceStore;
    private readonly scorer;
    private readonly patternDetector;
    private readonly linker;
    private readonly learner;
    private readonly logger;
    private readonly products;
    constructor(foundation: AiMemoryFoundation, history: ProductHistoryStore, preferenceStore: ProductPreferenceStore, scorer: ProductScorer, patternDetector: ProductPatternDetector, linker: ProductRelationshipLinker, learner: ProductLearner, logger: ProductMemoryLogger, products: Map<string, ProductRecord>);
    create(input: ProductCreateInput): Promise<ProductProcessResult>;
    update(productId: string, input: ProductUpdateInput): Promise<ProductProcessResult>;
    learnFromProject(productId: string): Promise<ProductLearningResult>;
    loadProduct(productId: string): Promise<ProductRecord | null>;
    private mergeVideoRelations;
    private appendMarketing;
    private toMemoryInput;
    private toPayload;
    private summarizeChanges;
    private fail;
}
//# sourceMappingURL=product-processor.d.ts.map