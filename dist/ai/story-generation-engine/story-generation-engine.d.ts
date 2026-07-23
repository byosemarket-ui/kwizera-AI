import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { StoryGenerationLogger } from "./story-generation-logger.js";
import { StoryGenerationRecordStore } from "./story-generation-stores.js";
import { StoryboardGenerationEngineStatusReport, StoryboardGenerationInput, StoryboardGenerationPlatform, StoryboardGenerationRecord, StoryboardGenerationResult, StoryboardGenerationSearchQuery } from "./types.js";
/**
 * AI Storyboard Generation Engine — creates production-ready storyboards
 * from prompts, products, campaigns, scripts, and marketing objectives.
 */
export declare class AiStoryboardGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: StoryGenerationLogger;
    readonly records: StoryGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private scenePlanningTimes;
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateStoryboard(input: StoryboardGenerationInput): Promise<StoryboardGenerationResult>;
    getStoryboard(storyboardId: string): StoryboardGenerationRecord | null;
    getStoryboardsByProduct(productId: string): StoryboardGenerationRecord[];
    getStoryboardsByProject(projectId: string): StoryboardGenerationRecord[];
    searchStoryboards(query: StoryboardGenerationSearchQuery): StoryboardGenerationRecord[];
    repairStoryboard(productId: string, platform?: StoryboardGenerationPlatform): Promise<StoryboardGenerationResult | null>;
    buildStatusReport(): StoryboardGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=story-generation-engine.d.ts.map