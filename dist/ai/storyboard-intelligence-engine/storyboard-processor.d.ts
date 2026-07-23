import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { StoryboardAnalyzer } from "./storyboard-analyzer.js";
import { StoryboardLinker } from "./storyboard-linker.js";
import { StoryboardLogger } from "./storyboard-logger.js";
import { StoryboardScorer } from "./storyboard-scorer.js";
import { StoryboardRecordStore } from "./storyboard-stores.js";
import { StoryboardIntelligenceInput, StoryboardIntelligenceRecord, StoryboardIntelligenceResult, StoryboardSearchQuery } from "./types.js";
export declare class StoryboardProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiProductIntelligenceFoundation, analyzer: StoryboardAnalyzer, scorer: StoryboardScorer, linker: StoryboardLinker, records: StoryboardRecordStore, logger: StoryboardLogger);
    createStoryboard(input: StoryboardIntelligenceInput): Promise<StoryboardIntelligenceResult>;
    search(query: StoryboardSearchQuery): StoryboardIntelligenceRecord[];
    private applyContinuityRepairs;
    private reject;
}
//# sourceMappingURL=storyboard-processor.d.ts.map