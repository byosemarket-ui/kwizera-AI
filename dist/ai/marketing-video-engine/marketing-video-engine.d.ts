import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { MarketingVideoLogger } from "./marketing-video-logger.js";
import { MarketingVideoRecordStore } from "./marketing-video-stores.js";
import { MarketingVideoEngineStatusReport, MarketingVideoInput, MarketingVideoRecord, MarketingVideoResult, MarketingVideoSearchQuery } from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
/**
 * AI Marketing Video Engine — high-converting, brand-consistent marketing video plans
 * optimized for audiences and platforms before production rendering.
 */
export declare class AiMarketingVideoEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: MarketingVideoLogger;
    readonly records: MarketingVideoRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private recommendationTimes;
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateMarketingVideoPlans(input: MarketingVideoInput): Promise<MarketingVideoResult>;
    getMarketingVideoPlan(marketingVideoId: string): MarketingVideoRecord | null;
    getMarketingVideoPlansByStoryboard(storyboardId: string): MarketingVideoRecord[];
    searchMarketingVideoPlans(query: MarketingVideoSearchQuery): MarketingVideoRecord[];
    repairMarketingVideoPlans(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<MarketingVideoResult | null>;
    buildStatusReport(): MarketingVideoEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=marketing-video-engine.d.ts.map