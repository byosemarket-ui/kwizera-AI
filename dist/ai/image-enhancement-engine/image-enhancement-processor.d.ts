import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageEnhancementAnalyzer } from "./image-enhancement-analyzer.js";
import { ImageEnhancementLinker } from "./image-enhancement-linker.js";
import { ImageEnhancementLogger } from "./image-enhancement-logger.js";
import { ImageEnhancementScorer } from "./image-enhancement-scorer.js";
import { ImageEnhancementRecordStore } from "./image-enhancement-stores.js";
import { ImageEnhancementInput, ImageEnhancementRecord, ImageEnhancementResult, ImageEnhancementSearchQuery } from "./types.js";
export declare class ImageEnhancementProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, analyzer: ImageEnhancementAnalyzer, scorer: ImageEnhancementScorer, linker: ImageEnhancementLinker, records: ImageEnhancementRecordStore, logger: ImageEnhancementLogger);
    generateEnhancementPlan(input: ImageEnhancementInput): Promise<ImageEnhancementResult>;
    search(query: ImageEnhancementSearchQuery): ImageEnhancementRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=image-enhancement-processor.d.ts.map