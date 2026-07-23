import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import { StoryboardLogger } from "./storyboard-logger.js";
import { StoryboardRecordStore } from "./storyboard-stores.js";
import { StoryboardIntelligenceEngineStatusReport, StoryboardIntelligenceInput, StoryboardIntelligenceRecord, StoryboardIntelligenceResult, StoryboardSearchQuery } from "./types.js";
/**
 * Storyboard Intelligence Engine — transforms approved creative direction into
 * production-ready storyboard intelligence before any media is generated.
 */
export declare class AiStoryboardIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: StoryboardLogger;
    readonly records: StoryboardRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    createStoryboard(input: StoryboardIntelligenceInput): Promise<StoryboardIntelligenceResult>;
    getStoryboard(storyboardId: string): StoryboardIntelligenceRecord | null;
    getStoryboardsByProduct(productId: string): StoryboardIntelligenceRecord[];
    searchStoryboards(query: StoryboardSearchQuery): StoryboardIntelligenceRecord[];
    detectRelationships(storyboardId: string): StoryboardIntelligenceRecord["relationships"] | null;
    repairStoryboard(productId: string, platform?: CreativePlatform): Promise<StoryboardIntelligenceResult | null>;
    buildStatusReport(): StoryboardIntelligenceEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=storyboard-intelligence-engine.d.ts.map