import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ProductImageGenerationAnalyzer } from "./product-image-generation-analyzer.js";
import { ProductImageGenerationLinker } from "./product-image-generation-linker.js";
import { ProductImageGenerationLogger } from "./product-image-generation-logger.js";
import { ProductImageGenerationScorer } from "./product-image-generation-scorer.js";
import { ProductImageGenerationRecordStore } from "./product-image-generation-stores.js";
import { ProductImageGenerationInput, ProductImageGenerationRecord, ProductImageGenerationResult, ProductImageGenerationSearchQuery } from "./types.js";
export declare class ProductImageGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, analyzer: ProductImageGenerationAnalyzer, scorer: ProductImageGenerationScorer, linker: ProductImageGenerationLinker, records: ProductImageGenerationRecordStore, logger: ProductImageGenerationLogger);
    generateProductImagePlan(input: ProductImageGenerationInput): Promise<ProductImageGenerationResult>;
    search(query: ProductImageGenerationSearchQuery): ProductImageGenerationRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=product-image-generation-processor.d.ts.map