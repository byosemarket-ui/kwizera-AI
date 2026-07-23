import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { CreativeImageAnalyzer } from "./creative-image-analyzer.js";
import { CreativeImageLinker } from "./creative-image-linker.js";
import { CreativeImageLogger } from "./creative-image-logger.js";
import { CreativeImageScorer } from "./creative-image-scorer.js";
import { CreativeImageIntelligenceRecordStore } from "./creative-image-stores.js";
import { CreativeImageIntelligenceInput, CreativeImageIntelligenceRecord, CreativeImageIntelligenceResult, CreativeImageIntelligenceSearchQuery } from "./types.js";
export declare class CreativeImageProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, analyzer: CreativeImageAnalyzer, scorer: CreativeImageScorer, linker: CreativeImageLinker, records: CreativeImageIntelligenceRecordStore, logger: CreativeImageLogger);
    plan(input: CreativeImageIntelligenceInput): Promise<CreativeImageIntelligenceResult>;
    search(query: CreativeImageIntelligenceSearchQuery): CreativeImageIntelligenceRecord[];
}
//# sourceMappingURL=creative-image-processor.d.ts.map