import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { MultiStyleImageAnalyzer } from "./multi-style-image-analyzer.js";
import { MultiStyleImageLinker } from "./multi-style-image-linker.js";
import { MultiStyleImageLogger } from "./multi-style-image-logger.js";
import { MultiStyleImageScorer } from "./multi-style-image-scorer.js";
import { MultiStyleImageRecordStore } from "./multi-style-image-stores.js";
import { MultiStyleImageInput, MultiStyleImageRecord, MultiStyleImageResult, MultiStyleImageSearchQuery } from "./types.js";
export declare class MultiStyleImageProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, analyzer: MultiStyleImageAnalyzer, scorer: MultiStyleImageScorer, linker: MultiStyleImageLinker, records: MultiStyleImageRecordStore, logger: MultiStyleImageLogger);
    generateStylePlan(input: MultiStyleImageInput): Promise<MultiStyleImageResult>;
    search(query: MultiStyleImageSearchQuery): MultiStyleImageRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=multi-style-image-processor.d.ts.map