import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageGenerationOptimizationAnalyzer } from "./image-generation-optimization-analyzer.js";
import { ImageGenerationOptimizationLinker } from "./image-generation-optimization-linker.js";
import { ImageGenerationOptimizationLogger } from "./image-generation-optimization-logger.js";
import { ImageGenerationOptimizationScorer } from "./image-generation-optimization-scorer.js";
import { ImageGenerationOptimizationRecordStore } from "./image-generation-optimization-stores.js";
import { ImageGenerationOptimizationInput, ImageGenerationOptimizationRecord, ImageGenerationOptimizationResult, ImageGenerationOptimizationSearchQuery } from "./types.js";
export declare class ImageGenerationOptimizationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, analyzer: ImageGenerationOptimizationAnalyzer, scorer: ImageGenerationOptimizationScorer, linker: ImageGenerationOptimizationLinker, records: ImageGenerationOptimizationRecordStore, logger: ImageGenerationOptimizationLogger);
    optimizeImageGeneration(input: ImageGenerationOptimizationInput): Promise<ImageGenerationOptimizationResult>;
    search(query: ImageGenerationOptimizationSearchQuery): ImageGenerationOptimizationRecord[];
    private resolveContext;
    private registerOptimizationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=image-generation-optimization-processor.d.ts.map