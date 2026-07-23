import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VideoProductionLogger } from "./video-production-logger.js";
import { VideoProductionRecordStore } from "./video-production-stores.js";
import { VideoProductionEngineStatusReport, VideoProductionInput, VideoProductionRecord, VideoProductionResult, VideoProductionSearchQuery } from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
/**
 * AI Video Production Engine — complete production-ready execution blueprints
 * validating assets, dependencies, workflows, and timelines before rendering.
 */
export declare class AiVideoProductionEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: VideoProductionLogger;
    readonly records: VideoProductionRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private validationTimes;
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateProductionPlans(input: VideoProductionInput): Promise<VideoProductionResult>;
    getProductionPlan(productionId: string): VideoProductionRecord | null;
    getProductionPlansByStoryboard(storyboardId: string): VideoProductionRecord[];
    searchProductionPlans(query: VideoProductionSearchQuery): VideoProductionRecord[];
    repairProductionPlans(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<VideoProductionResult | null>;
    buildStatusReport(): VideoProductionEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=video-production-engine.d.ts.map