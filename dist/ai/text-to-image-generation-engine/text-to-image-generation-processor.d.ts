import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { TextToImageGenerationAnalyzer } from "./text-to-image-generation-analyzer.js";
import { TextToImageGenerationLinker } from "./text-to-image-generation-linker.js";
import { TextToImageGenerationLogger } from "./text-to-image-generation-logger.js";
import { TextToImageGenerationScorer } from "./text-to-image-generation-scorer.js";
import { TextToImageGenerationRecordStore } from "./text-to-image-generation-stores.js";
import { TextToImageGenerationInput, TextToImageGenerationRecord, TextToImageGenerationResult, TextToImageSearchQuery } from "./types.js";
export declare class TextToImageGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, analyzer: TextToImageGenerationAnalyzer, scorer: TextToImageGenerationScorer, linker: TextToImageGenerationLinker, records: TextToImageGenerationRecordStore, logger: TextToImageGenerationLogger);
    generateImagePlan(input: TextToImageGenerationInput): Promise<TextToImageGenerationResult>;
    search(query: TextToImageSearchQuery): TextToImageGenerationRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=text-to-image-generation-processor.d.ts.map