import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageRenderAnalyzer } from "./image-render-analyzer.js";
import { ImageRenderLinker } from "./image-render-linker.js";
import { ImageRenderLogger } from "./image-render-logger.js";
import { ImageRenderScorer } from "./image-render-scorer.js";
import { ImageRenderRecordStore } from "./image-render-stores.js";
import { ImageRenderInput, ImageRenderRecord, ImageRenderResult, ImageRenderSearchQuery } from "./types.js";
export declare class ImageRenderProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, analyzer: ImageRenderAnalyzer, scorer: ImageRenderScorer, linker: ImageRenderLinker, records: ImageRenderRecordStore, logger: ImageRenderLogger);
    generateRenderPlan(input: ImageRenderInput): Promise<ImageRenderResult>;
    search(query: ImageRenderSearchQuery): ImageRenderRecord[];
    private resolveContext;
    private registerRenderAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=image-render-processor.d.ts.map