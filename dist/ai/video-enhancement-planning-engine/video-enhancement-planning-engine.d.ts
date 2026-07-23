import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { VideoEnhancementLogger } from "./video-enhancement-logger.js";
import { VideoEnhancementRecordStore } from "./video-enhancement-stores.js";
import { VideoEnhancementPlatform, EnhancementType, VideoEnhancementEngineStatusReport, VideoEnhancementPlanningInput, VideoEnhancementPlanRecord, VideoEnhancementPlanningResult, VideoEnhancementSearchQuery } from "./types.js";
/**
 * Video Enhancement Planning Engine — prepares complete non-destructive enhancement strategy before editing.
 */
export declare class AiVideoEnhancementPlanningEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: VideoEnhancementLogger;
    readonly records: VideoEnhancementRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    planEnhancement(input: VideoEnhancementPlanningInput): Promise<VideoEnhancementPlanningResult>;
    getEnhancementPlan(videoId: string): VideoEnhancementPlanRecord | null;
    searchEnhancementPlans(query: VideoEnhancementSearchQuery): VideoEnhancementPlanRecord[];
    repairEnhancementPlan(videoId: string): Promise<VideoEnhancementPlanningResult | null>;
    buildStatusReport(): VideoEnhancementEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
export { VideoEnhancementPlatform, EnhancementType };
//# sourceMappingURL=video-enhancement-planning-engine.d.ts.map