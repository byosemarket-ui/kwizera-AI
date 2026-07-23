import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoIntelligenceOptimizationAnalyzer } from "./video-intelligence-optimization-analyzer.js";
import { VideoIntelligenceOptimizationLinker } from "./video-intelligence-optimization-linker.js";
import { VideoIntelligenceOptimizationLogger } from "./video-intelligence-optimization-logger.js";
import { VideoIntelligenceOptimizationScorer } from "./video-intelligence-optimization-scorer.js";
import { VideoIntelligenceOptimizationRecordStore } from "./video-intelligence-optimization-stores.js";
import { VideoIntelligenceOptimizationInput, VideoIntelligenceOptimizationRecord, VideoIntelligenceOptimizationResult, VideoIntelligenceOptimizationSearchQuery } from "./types.js";
export declare class VideoIntelligenceOptimizationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoIntelligenceFoundation, analyzer: VideoIntelligenceOptimizationAnalyzer, scorer: VideoIntelligenceOptimizationScorer, linker: VideoIntelligenceOptimizationLinker, records: VideoIntelligenceOptimizationRecordStore, logger: VideoIntelligenceOptimizationLogger);
    runOptimization(input: VideoIntelligenceOptimizationInput): Promise<VideoIntelligenceOptimizationResult>;
    search(query: VideoIntelligenceOptimizationSearchQuery): VideoIntelligenceOptimizationRecord[];
    restoreRecoveryPoint(recoveryId: string): boolean;
    private reject;
}
//# sourceMappingURL=video-intelligence-optimization-processor.d.ts.map