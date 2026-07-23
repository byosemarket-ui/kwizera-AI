import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoAnalysisLogger } from "./video-analysis-logger.js";
import { VideoAnalysisRecordStore } from "./video-analysis-stores.js";
import { VideoAnalysisEngineInput, VideoAnalysisEngineResult, VideoAnalysisEngineStatusReport, VideoAnalysisIntelligenceRecord, VideoAnalysisSearchQuery, VideoFileFormat, VideoAnalysisType, VideoCodec, AudioCodec, VideoContainer, FrameRateMode, VideoColorSpace } from "./types.js";
/**
 * Video Analysis Engine — collects, organizes and analyzes technical and structural video information
 * before understanding, enhancement or generation begins.
 */
export declare class AiVideoAnalysisEngine {
    private foundation;
    private storageRoot;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: VideoAnalysisLogger;
    readonly records: VideoAnalysisRecordStore;
    private readonly analyzer;
    private readonly completeness;
    private readonly scorer;
    private readonly linker;
    private processor;
    private analysisTimes;
    private searchTimes;
    private indexingTimes;
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeVideo(input: VideoAnalysisEngineInput): Promise<VideoAnalysisEngineResult>;
    getVideo(videoId: string): VideoAnalysisIntelligenceRecord | null;
    searchVideos(query: VideoAnalysisSearchQuery): VideoAnalysisIntelligenceRecord[];
    detectRelationships(videoId: string): VideoAnalysisIntelligenceRecord["relationships"] | null;
    repairVideo(videoId: string): Promise<VideoAnalysisEngineResult | null>;
    buildStatusReport(): VideoAnalysisEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getEngineDir(): string;
    private ensureReady;
}
export { VideoFileFormat, VideoAnalysisType, VideoCodec, AudioCodec, VideoContainer, FrameRateMode, VideoColorSpace, };
//# sourceMappingURL=video-analysis-engine.d.ts.map