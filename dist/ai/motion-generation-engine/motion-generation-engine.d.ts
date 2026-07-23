import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { MotionGenerationLogger } from "./motion-generation-logger.js";
import { MotionGenerationRecordStore } from "./motion-generation-stores.js";
import { MotionGenerationEngineStatusReport, MotionGenerationInput, MotionGenerationRecord, MotionGenerationResult, MotionGenerationSearchQuery, StoryboardGenerationPlatform } from "./types.js";
/**
 * AI Motion Generation Engine — intelligent movement plans for scenes,
 * characters, products, objects, and camera synchronization.
 */
export declare class AiMotionGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: MotionGenerationLogger;
    readonly records: MotionGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private syncTimes;
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateMotionPlans(input: MotionGenerationInput): Promise<MotionGenerationResult>;
    getMotionPlan(motionPlanId: string): MotionGenerationRecord | null;
    getMotionPlansByScene(sceneId: string): MotionGenerationRecord[];
    getMotionPlansByStoryboard(storyboardId: string): MotionGenerationRecord[];
    searchMotionPlans(query: MotionGenerationSearchQuery): MotionGenerationRecord[];
    repairMotionPlans(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<MotionGenerationResult | null>;
    buildStatusReport(): MotionGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=motion-generation-engine.d.ts.map