import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VideoGenerationOptimizationAnalyzer } from "./video-generation-optimization-analyzer.js";
import { VideoGenerationOptimizationLinker } from "./video-generation-optimization-linker.js";
import { VideoGenerationOptimizationLogger } from "./video-generation-optimization-logger.js";
import { VideoGenerationOptimizationScorer } from "./video-generation-optimization-scorer.js";
import { OptimizationRecordStore } from "./video-generation-optimization-stores.js";
import { VideoGenerationOptimizationInput, VideoGenerationOptimizationRecord, VideoGenerationOptimizationResult, VideoGenerationOptimizationSearchQuery } from "./types.js";
export declare class VideoGenerationOptimizationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, analyzer: VideoGenerationOptimizationAnalyzer, scorer: VideoGenerationOptimizationScorer, linker: VideoGenerationOptimizationLinker, records: OptimizationRecordStore, logger: VideoGenerationOptimizationLogger);
    optimizeVideoGeneration(input: VideoGenerationOptimizationInput): Promise<VideoGenerationOptimizationResult>;
    search(query: VideoGenerationOptimizationSearchQuery): VideoGenerationOptimizationRecord[];
    private resolveBundles;
    private registerGenerationAsset;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=video-generation-optimization-processor.d.ts.map