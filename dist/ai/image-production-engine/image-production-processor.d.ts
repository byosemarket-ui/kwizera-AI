import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageProductionAnalyzer } from "./image-production-analyzer.js";
import { ImageProductionLinker } from "./image-production-linker.js";
import { ImageProductionLogger } from "./image-production-logger.js";
import { ImageProductionScorer } from "./image-production-scorer.js";
import { ImageProductionRecordStore } from "./image-production-stores.js";
import { ImageProductionInput, ImageProductionRecord, ImageProductionResult, ImageProductionSearchQuery } from "./types.js";
export declare class ImageProductionProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, analyzer: ImageProductionAnalyzer, scorer: ImageProductionScorer, linker: ImageProductionLinker, records: ImageProductionRecordStore, logger: ImageProductionLogger);
    generateProductionPlan(input: ImageProductionInput): Promise<ImageProductionResult>;
    search(query: ImageProductionSearchQuery): ImageProductionRecord[];
    private resolveContext;
    private registerProductionAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=image-production-processor.d.ts.map