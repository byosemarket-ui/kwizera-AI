import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoQualityPredictionLogger } from "./video-quality-prediction-logger.js";
import { VideoQualityPredictionRecordStore } from "./video-quality-prediction-stores.js";
import { VideoQualityPredictionEngineStatusReport, VideoQualityPredictionInput, VideoQualityPredictionRecord, VideoQualityPredictionResult, VideoQualityPredictionSearchQuery, VideoQualityPredictionPlatform } from "./types.js";
/**
 * Video Quality Prediction Engine — predicts quality, risks, and readiness before generation or rendering.
 */
export declare class AiVideoQualityPredictionEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: VideoQualityPredictionLogger;
    readonly records: VideoQualityPredictionRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private predictionTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    predictVideoQuality(input: VideoQualityPredictionInput): Promise<VideoQualityPredictionResult>;
    getQualityPrediction(videoId: string): VideoQualityPredictionRecord | null;
    searchQualityPredictions(query: VideoQualityPredictionSearchQuery): VideoQualityPredictionRecord[];
    detectRelationships(videoId: string): VideoQualityPredictionRecord["relationships"] | null;
    repairQualityPrediction(videoId: string): Promise<VideoQualityPredictionResult | null>;
    buildStatusReport(): VideoQualityPredictionEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
export { VideoQualityPredictionPlatform };
//# sourceMappingURL=video-quality-prediction-engine.d.ts.map