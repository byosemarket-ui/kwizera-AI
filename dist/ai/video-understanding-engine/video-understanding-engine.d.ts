import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoUnderstandingLogger } from "./video-understanding-logger.js";
import { VideoUnderstandingRecordStore } from "./video-understanding-stores.js";
import { VideoStoryType, VideoUnderstandingEngineStatusReport, VideoUnderstandingInput, VideoUnderstandingMarketingGoal, VideoUnderstandingRecord, VideoUnderstandingResult, VideoUnderstandingSearchQuery } from "./types.js";
/**
 * Video Understanding Engine — transforms technical video analysis into deep semantic understanding.
 */
export declare class AiVideoUnderstandingEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: VideoUnderstandingLogger;
    readonly records: VideoUnderstandingRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private understandingTimes;
    private searchTimes;
    private relationshipTimes;
    private graphBuildTimes;
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    understandVideo(input: VideoUnderstandingInput): Promise<VideoUnderstandingResult>;
    getUnderstanding(videoId: string): VideoUnderstandingRecord | null;
    searchUnderstanding(query: VideoUnderstandingSearchQuery): VideoUnderstandingRecord[];
    detectRelationships(videoId: string): VideoUnderstandingRecord["relationships"] | null;
    repairUnderstanding(videoId: string): Promise<VideoUnderstandingResult | null>;
    buildStatusReport(): VideoUnderstandingEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getEngineDir(): string;
    private ensureReady;
}
export { VideoStoryType, VideoUnderstandingMarketingGoal };
//# sourceMappingURL=video-understanding-engine.d.ts.map