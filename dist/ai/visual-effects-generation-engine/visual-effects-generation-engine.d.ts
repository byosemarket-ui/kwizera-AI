import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VisualEffectsGenerationLogger } from "./visual-effects-generation-logger.js";
import { VisualEffectsGenerationRecordStore } from "./visual-effects-generation-stores.js";
import { VisualEffectsGenerationEngineStatusReport, VisualEffectsGenerationInput, VisualEffectsGenerationRecord, VisualEffectsGenerationResult, VisualEffectsGenerationSearchQuery } from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
/**
 * AI Visual Effects Generation Engine — production-ready visual effects blueprints
 * for lighting, atmospheric, product, environment, transition, and color effects.
 */
export declare class AiVisualEffectsGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: VisualEffectsGenerationLogger;
    readonly records: VisualEffectsGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private syncTimes;
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateVisualEffectPlans(input: VisualEffectsGenerationInput): Promise<VisualEffectsGenerationResult>;
    getVisualEffectPlan(visualEffectPlanId: string): VisualEffectsGenerationRecord | null;
    getVisualEffectPlansByScene(sceneId: string): VisualEffectsGenerationRecord[];
    getVisualEffectPlansByStoryboard(storyboardId: string): VisualEffectsGenerationRecord[];
    searchVisualEffectPlans(query: VisualEffectsGenerationSearchQuery): VisualEffectsGenerationRecord[];
    repairVisualEffectPlans(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<VisualEffectsGenerationResult | null>;
    buildStatusReport(): VisualEffectsGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=visual-effects-generation-engine.d.ts.map