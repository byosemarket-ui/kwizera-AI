import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import type { VideoQualityPredictionPlatform } from "../video-quality-prediction-engine/types.js";
import { VideoIntelligenceOptimizationLogger } from "./video-intelligence-optimization-logger.js";
import { VideoIntelligenceOptimizationRecordStore } from "./video-intelligence-optimization-stores.js";
import { VideoIntelligenceOptimizationEngineStatusReport, VideoIntelligenceOptimizationInput, VideoIntelligenceOptimizationRecord, VideoIntelligenceOptimizationResult, VideoIntelligenceOptimizationSearchQuery } from "./types.js";
/**
 * Video Intelligence Optimization Engine — continuously improves quality,
 * speed, consistency and efficiency across all Video Intelligence modules.
 */
export declare class AiVideoIntelligenceOptimizationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: VideoIntelligenceOptimizationLogger;
    readonly records: VideoIntelligenceOptimizationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private optimizationTimes;
    private searchTimes;
    private recoveryTimes;
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    runOptimization(input: VideoIntelligenceOptimizationInput): Promise<VideoIntelligenceOptimizationResult>;
    getOptimization(optimizationId: string): VideoIntelligenceOptimizationRecord | null;
    getOptimizationsByVideo(videoId: string): VideoIntelligenceOptimizationRecord[];
    searchOptimizations(query: VideoIntelligenceOptimizationSearchQuery): VideoIntelligenceOptimizationRecord[];
    restoreRecoveryPoint(recoveryId: string): boolean;
    repairOptimization(videoId: string, _platform?: VideoQualityPredictionPlatform): Promise<VideoIntelligenceOptimizationResult | null>;
    getCache(): import("./types.js").VideoCacheOptimization;
    buildStatusReport(): VideoIntelligenceOptimizationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=video-intelligence-optimization-engine.d.ts.map