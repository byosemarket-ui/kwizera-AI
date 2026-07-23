import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductUnderstandingAnalyzer } from "./product-understanding-analyzer.js";
import { ProductUnderstandingLinker } from "./product-understanding-linker.js";
import { ProductUnderstandingLogger } from "./product-understanding-logger.js";
import { ProductUnderstandingScorer } from "./product-understanding-scorer.js";
import { ProductUnderstandingRecordStore } from "./product-understanding-stores.js";
import { ProductUnderstandingInput, ProductUnderstandingRecord, ProductUnderstandingResult, ProductUnderstandingSearchQuery } from "./types.js";
export declare class ProductUnderstandingProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, analyzer: ProductUnderstandingAnalyzer, scorer: ProductUnderstandingScorer, linker: ProductUnderstandingLinker, records: ProductUnderstandingRecordStore, logger: ProductUnderstandingLogger);
    understand(input: ProductUnderstandingInput): Promise<ProductUnderstandingResult>;
    search(query: ProductUnderstandingSearchQuery): ProductUnderstandingRecord[];
}
//# sourceMappingURL=product-understanding-processor.d.ts.map