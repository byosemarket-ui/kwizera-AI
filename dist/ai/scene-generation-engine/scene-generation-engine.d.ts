import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { SceneGenerationLogger } from "./scene-generation-logger.js";
import { SceneGenerationRecordStore } from "./scene-generation-stores.js";
import { SceneGenerationEngineStatusReport, SceneGenerationInput, SceneGenerationRecord, SceneGenerationResult, SceneGenerationSearchQuery, StoryboardGenerationPlatform } from "./types.js";
/**
 * AI Scene Generation Engine — transforms approved storyboards into
 * production-ready scene blueprints for AI video generation.
 */
export declare class AiSceneGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: SceneGenerationLogger;
    readonly records: SceneGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private shotPlanningTimes;
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateScenes(input: SceneGenerationInput): Promise<SceneGenerationResult>;
    getScene(sceneId: string): SceneGenerationRecord | null;
    getScenesByStoryboard(storyboardId: string): SceneGenerationRecord[];
    getScenesByProduct(productId: string): SceneGenerationRecord[];
    searchScenes(query: SceneGenerationSearchQuery): SceneGenerationRecord[];
    repairScenes(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<SceneGenerationResult | null>;
    buildStatusReport(): SceneGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=scene-generation-engine.d.ts.map