import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { AnimationGenerationLogger } from "./animation-generation-logger.js";
import { AnimationGenerationRecordStore } from "./animation-generation-stores.js";
import { AnimationGenerationEngineStatusReport, AnimationGenerationInput, AnimationGenerationRecord, AnimationGenerationResult, AnimationGenerationSearchQuery, StoryboardGenerationPlatform } from "./types.js";
/**
 * AI Animation Generation Engine — professional animation blueprints for
 * characters, products, objects, typography, effects, and environments.
 */
export declare class AiAnimationGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: AnimationGenerationLogger;
    readonly records: AnimationGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private syncTimes;
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateAnimationPlans(input: AnimationGenerationInput): Promise<AnimationGenerationResult>;
    getAnimationPlan(animationPlanId: string): AnimationGenerationRecord | null;
    getAnimationPlansByScene(sceneId: string): AnimationGenerationRecord[];
    getAnimationPlansByStoryboard(storyboardId: string): AnimationGenerationRecord[];
    searchAnimationPlans(query: AnimationGenerationSearchQuery): AnimationGenerationRecord[];
    repairAnimationPlans(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<AnimationGenerationResult | null>;
    buildStatusReport(): AnimationGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=animation-generation-engine.d.ts.map