import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageEditingAnalyzer } from "./image-editing-analyzer.js";
import { ImageEditingLinker } from "./image-editing-linker.js";
import { ImageEditingLogger } from "./image-editing-logger.js";
import { ImageEditingScorer } from "./image-editing-scorer.js";
import { ImageEditingRecordStore } from "./image-editing-stores.js";
import { ImageEditingInput, ImageEditingRecord, ImageEditingResult, ImageEditingSearchQuery } from "./types.js";
export declare class ImageEditingProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, analyzer: ImageEditingAnalyzer, scorer: ImageEditingScorer, linker: ImageEditingLinker, records: ImageEditingRecordStore, logger: ImageEditingLogger);
    generateEditingPlan(input: ImageEditingInput): Promise<ImageEditingResult>;
    search(query: ImageEditingSearchQuery): ImageEditingRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=image-editing-processor.d.ts.map