import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
import { RenderingPreparationLogger } from "./rendering-preparation-logger.js";
import { RenderingPreparationRecordStore } from "./rendering-preparation-stores.js";
import { RenderingPreparationEngineStatusReport, RenderingPreparationInput, RenderingPreparationRecord, RenderingPreparationResult, RenderingPreparationSearchQuery } from "./types.js";
/**
 * AI Rendering Preparation Engine — validates, organizes and prepares assets,
 * timelines and production instructions required before rendering starts.
 */
export declare class AiRenderingPreparationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: RenderingPreparationLogger;
    readonly records: RenderingPreparationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private preparationTimes;
    private searchTimes;
    private validationTimes;
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    prepareRenderPlans(input: RenderingPreparationInput): Promise<RenderingPreparationResult>;
    getRenderPlan(renderPlanId: string): RenderingPreparationRecord | null;
    getRenderPlansByStoryboard(storyboardId: string): RenderingPreparationRecord[];
    searchRenderPlans(query: RenderingPreparationSearchQuery): RenderingPreparationRecord[];
    repairRenderPlans(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<RenderingPreparationResult | null>;
    buildStatusReport(): RenderingPreparationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=rendering-preparation-engine.d.ts.map