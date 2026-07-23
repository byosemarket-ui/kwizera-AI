import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { StoryGenerationAnalyzer } from "./story-generation-analyzer.js";
import { StoryGenerationLinker } from "./story-generation-linker.js";
import { StoryGenerationLogger } from "./story-generation-logger.js";
import { StoryGenerationScorer } from "./story-generation-scorer.js";
import { StoryGenerationRecordStore } from "./story-generation-stores.js";
import { StoryboardGenerationInput, StoryboardGenerationRecord, StoryboardGenerationResult, StoryboardGenerationSearchQuery } from "./types.js";
export declare class StoryGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, analyzer: StoryGenerationAnalyzer, scorer: StoryGenerationScorer, linker: StoryGenerationLinker, records: StoryGenerationRecordStore, logger: StoryGenerationLogger);
    generateStoryboard(input: StoryboardGenerationInput): Promise<StoryboardGenerationResult>;
    search(query: StoryboardGenerationSearchQuery): StoryboardGenerationRecord[];
    private resolveContext;
    private registerGenerationAsset;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=story-generation-processor.d.ts.map