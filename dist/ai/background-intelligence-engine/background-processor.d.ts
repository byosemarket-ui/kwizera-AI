import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { BackgroundAnalyzer } from "./background-analyzer.js";
import { BackgroundLinker } from "./background-linker.js";
import { BackgroundLogger } from "./background-logger.js";
import { BackgroundScorer } from "./background-scorer.js";
import { BackgroundIntelligenceRecordStore } from "./background-stores.js";
import { BackgroundIntelligenceInput, BackgroundIntelligenceRecord, BackgroundIntelligenceResult, BackgroundIntelligenceSearchQuery } from "./types.js";
export declare class BackgroundProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageIntelligenceFoundation, analyzer: BackgroundAnalyzer, scorer: BackgroundScorer, linker: BackgroundLinker, records: BackgroundIntelligenceRecordStore, logger: BackgroundLogger);
    analyze(input: BackgroundIntelligenceInput): Promise<BackgroundIntelligenceResult>;
    search(query: BackgroundIntelligenceSearchQuery): BackgroundIntelligenceRecord[];
}
//# sourceMappingURL=background-processor.d.ts.map