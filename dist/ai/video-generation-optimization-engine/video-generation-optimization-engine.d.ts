import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
import { VideoGenerationOptimizationLogger } from "./video-generation-optimization-logger.js";
import { OptimizationRecordStore } from "./video-generation-optimization-stores.js";
import { VideoGenerationOptimizationEngineStatusReport, VideoGenerationOptimizationInput, VideoGenerationOptimizationRecord, VideoGenerationOptimizationResult, VideoGenerationOptimizationSearchQuery } from "./types.js";
/**
 * AI Video Generation Optimization Engine — optimizes the entire AI Video Generation
 * pipeline before rendering, improving quality, speed, reliability and scalability
 * without changing approved creative decisions.
 */
export declare class AiVideoGenerationOptimizationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: VideoGenerationOptimizationLogger;
    readonly records: OptimizationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private optimizationTimes;
    private searchTimes;
    private repairTimes;
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    optimizeVideoGeneration(input: VideoGenerationOptimizationInput): Promise<VideoGenerationOptimizationResult>;
    getOptimizationRecord(optimizationId: string): VideoGenerationOptimizationRecord | null;
    getOptimizationsByStoryboard(storyboardId: string): VideoGenerationOptimizationRecord[];
    searchOptimizations(query: VideoGenerationOptimizationSearchQuery): VideoGenerationOptimizationRecord[];
    repairOptimization(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<VideoGenerationOptimizationResult | null>;
    buildStatusReport(): VideoGenerationOptimizationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=video-generation-optimization-engine.d.ts.map