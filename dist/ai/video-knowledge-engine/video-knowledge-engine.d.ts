import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { VideoKnowledgeLogger } from "./video-logger.js";
import { VideoPatternStore, VideoRecordStore } from "./video-stores.js";
import { VideoAnalysisInput, VideoAnalysisRecord, VideoAnalysisResult, VideoKnowledgeStatusReport, VideoLearningPattern, VideoRecommendation, VideoSearchQuery } from "./types.js";
/**
 * Video Knowledge Engine — understands, analyzes and learns from promotional video knowledge.
 */
export declare class AiVideoKnowledgeEngine {
    private foundation;
    private storageRoot;
    private initialized;
    private startupComplete;
    readonly logger: VideoKnowledgeLogger;
    readonly patterns: VideoPatternStore;
    readonly records: VideoRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly recommender;
    private readonly linker;
    private processor;
    private learner;
    private analysisTimes;
    private searchTimes;
    private recommendationTimes;
    initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeVideo(input: VideoAnalysisInput): Promise<VideoAnalysisResult>;
    getVideo(videoId: string): VideoAnalysisRecord | null;
    searchVideos(query: VideoSearchQuery): Promise<VideoAnalysisRecord[]>;
    getRecommendations(videoId: string): VideoRecommendation[];
    detectRelationships(videoId: string): import("./types.js").VideoRelationships | null;
    getLearnedPatterns(): VideoLearningPattern[];
    buildStatusReport(): VideoKnowledgeStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=video-knowledge-engine.d.ts.map