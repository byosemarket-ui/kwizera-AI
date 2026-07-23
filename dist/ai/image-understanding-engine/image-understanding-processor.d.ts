import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageUnderstandingAnalyzer } from "./image-understanding-analyzer.js";
import { ImageUnderstandingLinker } from "./image-understanding-linker.js";
import { ImageUnderstandingLogger } from "./image-understanding-logger.js";
import { ImageUnderstandingScorer } from "./image-understanding-scorer.js";
import { ImageUnderstandingRecordStore } from "./image-understanding-stores.js";
import { ImageUnderstandingInput, ImageUnderstandingRecord, ImageUnderstandingResult, ImageUnderstandingSearchQuery } from "./types.js";
export declare class ImageUnderstandingProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, analyzer: ImageUnderstandingAnalyzer, scorer: ImageUnderstandingScorer, linker: ImageUnderstandingLinker, records: ImageUnderstandingRecordStore, logger: ImageUnderstandingLogger);
    understand(input: ImageUnderstandingInput): Promise<ImageUnderstandingResult>;
    search(query: ImageUnderstandingSearchQuery): ImageUnderstandingRecord[];
}
//# sourceMappingURL=image-understanding-processor.d.ts.map