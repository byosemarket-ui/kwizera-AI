import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VideoProductionAnalyzer } from "./video-production-analyzer.js";
import { VideoProductionLinker } from "./video-production-linker.js";
import { VideoProductionLogger } from "./video-production-logger.js";
import { VideoProductionScorer } from "./video-production-scorer.js";
import { VideoProductionRecordStore } from "./video-production-stores.js";
import { VideoProductionInput, VideoProductionRecord, VideoProductionResult, VideoProductionSearchQuery } from "./types.js";
export declare class VideoProductionProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, analyzer: VideoProductionAnalyzer, scorer: VideoProductionScorer, linker: VideoProductionLinker, records: VideoProductionRecordStore, logger: VideoProductionLogger);
    generateProductionPlans(input: VideoProductionInput): Promise<VideoProductionResult>;
    search(query: VideoProductionSearchQuery): VideoProductionRecord[];
    private resolveBundles;
    private registerGenerationAsset;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=video-production-processor.d.ts.map