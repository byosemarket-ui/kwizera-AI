import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { VideoHistoryStore } from "./video-history-store.js";
import { VideoMemoryLogger } from "./video-logger.js";
import { VideoPatternStore } from "./video-pattern-store.js";
import { VideoCreateInput, VideoLearningResult, VideoMemoryStatusReport, VideoPattern, VideoProcessResult, VideoRecord, VideoRelationships, VideoUpdateInput } from "./types.js";
/**
 * Video Memory Engine — permanent video production knowledge storage and learning.
 */
export declare class AiVideoMemoryEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: VideoMemoryLogger;
    readonly history: VideoHistoryStore;
    readonly patterns: VideoPatternStore;
    private readonly videos;
    private readonly scorer;
    private linker;
    private patternDetector;
    private learner;
    private processor;
    private saveTimes;
    private loadTimes;
    private searchTimes;
    initialize(foundation: AiMemoryFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    createVideo(input: VideoCreateInput): Promise<VideoProcessResult>;
    updateVideo(videoId: string, input: VideoUpdateInput): Promise<VideoProcessResult>;
    completeVideo(videoId: string, userSatisfaction?: number): Promise<VideoLearningResult>;
    getVideo(videoId: string): Promise<VideoRecord | null>;
    listVideos(): Promise<VideoRecord[]>;
    getVideoRelationships(videoId: string): VideoRelationships | null;
    getDetectedPatterns(): VideoPattern[];
    getReusablePatterns(): VideoPattern[];
    searchVideos(query: {
        name?: string;
        projectId?: string;
        brand?: string;
        category?: string;
        style?: string;
        language?: string;
        marketingGoal?: string;
        sceneType?: string;
        callToAction?: string;
        animation?: string;
        music?: string;
        transition?: string;
        tags?: string[];
    }): VideoRecord[];
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    buildStatusReport(): VideoMemoryStatusReport;
    private ensureReady;
}
//# sourceMappingURL=video-memory-engine.d.ts.map