import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageToImageGenerationAnalyzer } from "./image-to-image-generation-analyzer.js";
import { ImageToImageGenerationLinker } from "./image-to-image-generation-linker.js";
import { ImageToImageGenerationLogger } from "./image-to-image-generation-logger.js";
import { ImageToImageGenerationScorer } from "./image-to-image-generation-scorer.js";
import { ImageToImageGenerationRecordStore } from "./image-to-image-generation-stores.js";
import { ImageToImageGenerationInput, ImageToImageGenerationRecord, ImageToImageGenerationResult, ImageToImageSearchQuery } from "./types.js";
export declare class ImageToImageGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, analyzer: ImageToImageGenerationAnalyzer, scorer: ImageToImageGenerationScorer, linker: ImageToImageGenerationLinker, records: ImageToImageGenerationRecordStore, logger: ImageToImageGenerationLogger);
    generateTransformationPlan(input: ImageToImageGenerationInput): Promise<ImageToImageGenerationResult>;
    search(query: ImageToImageSearchQuery): ImageToImageGenerationRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=image-to-image-generation-processor.d.ts.map