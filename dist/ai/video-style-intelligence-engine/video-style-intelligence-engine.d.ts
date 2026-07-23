import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoStyleLogger } from "./video-style-logger.js";
import { VideoStyleRecordStore } from "./video-style-stores.js";
import { VideoStyleTemplateLibrary } from "./video-style-template-library.js";
import { CinematicStyleClass, StyleTemplatePlatform, VideoStyleEngineStatusReport, VideoStyleIntelligenceInput, VideoStyleIntelligenceRecord, VideoStyleIntelligenceResult, VideoStyleSearchQuery } from "./types.js";
/**
 * Video Style Intelligence Engine — analyzes, classifies and plans visual, cinematic and editing style.
 */
export declare class AiVideoStyleIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: VideoStyleLogger;
    readonly records: VideoStyleRecordStore;
    readonly templateLibrary: VideoStyleTemplateLibrary;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private analysisTimes;
    private searchTimes;
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeStyle(input: VideoStyleIntelligenceInput): Promise<VideoStyleIntelligenceResult>;
    getStyleAnalysis(videoId: string): VideoStyleIntelligenceRecord | null;
    searchStyleAnalysis(query: VideoStyleSearchQuery): VideoStyleIntelligenceRecord[];
    repairStyleAnalysis(videoId: string): Promise<VideoStyleIntelligenceResult | null>;
    buildStatusReport(): VideoStyleEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
export { CinematicStyleClass, StyleTemplatePlatform };
//# sourceMappingURL=video-style-intelligence-engine.d.ts.map