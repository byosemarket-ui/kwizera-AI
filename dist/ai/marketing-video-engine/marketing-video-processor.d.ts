import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { MarketingVideoAnalyzer } from "./marketing-video-analyzer.js";
import { MarketingVideoLinker } from "./marketing-video-linker.js";
import { MarketingVideoLogger } from "./marketing-video-logger.js";
import { MarketingVideoScorer } from "./marketing-video-scorer.js";
import { MarketingVideoRecordStore } from "./marketing-video-stores.js";
import { MarketingVideoInput, MarketingVideoRecord, MarketingVideoResult, MarketingVideoSearchQuery } from "./types.js";
export declare class MarketingVideoProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, analyzer: MarketingVideoAnalyzer, scorer: MarketingVideoScorer, linker: MarketingVideoLinker, records: MarketingVideoRecordStore, logger: MarketingVideoLogger);
    generateMarketingVideoPlans(input: MarketingVideoInput): Promise<MarketingVideoResult>;
    search(query: MarketingVideoSearchQuery): MarketingVideoRecord[];
    private resolveBundles;
    private registerGenerationAsset;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=marketing-video-processor.d.ts.map