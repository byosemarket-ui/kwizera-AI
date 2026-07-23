import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoQualityPredictionAnalyzer } from "./video-quality-prediction-analyzer.js";
import { VideoQualityPredictionLinker } from "./video-quality-prediction-linker.js";
import { VideoQualityPredictionLogger } from "./video-quality-prediction-logger.js";
import { VideoQualityPredictionScorer } from "./video-quality-prediction-scorer.js";
import { VideoQualityPredictionRecordStore } from "./video-quality-prediction-stores.js";
import { VideoQualityPredictionInput, VideoQualityPredictionRecord, VideoQualityPredictionResult, VideoQualityPredictionSearchQuery } from "./types.js";
export declare class VideoQualityPredictionProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoIntelligenceFoundation, analyzer: VideoQualityPredictionAnalyzer, scorer: VideoQualityPredictionScorer, linker: VideoQualityPredictionLinker, records: VideoQualityPredictionRecordStore, logger: VideoQualityPredictionLogger);
    predict(input: VideoQualityPredictionInput): Promise<VideoQualityPredictionResult>;
    search(query: VideoQualityPredictionSearchQuery): VideoQualityPredictionRecord[];
    private fail;
}
//# sourceMappingURL=video-quality-prediction-processor.d.ts.map