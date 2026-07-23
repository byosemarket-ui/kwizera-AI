import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { CameraDirectorLogger } from "./camera-director-logger.js";
import { CameraDirectorRecordStore } from "./camera-director-stores.js";
import { CameraDirectorEngineStatusReport, CameraDirectorInput, CameraDirectorRecord, CameraDirectorResult, CameraDirectorSearchQuery, StoryboardGenerationPlatform } from "./types.js";
/**
 * AI Camera Director Engine — plans and directs virtual camera behavior
 * for production-ready AI video generation.
 */
export declare class AiCameraDirectorEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: CameraDirectorLogger;
    readonly records: CameraDirectorRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private compositionTimes;
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    planCamera(input: CameraDirectorInput): Promise<CameraDirectorResult>;
    getCameraPlan(cameraPlanId: string): CameraDirectorRecord | null;
    getCameraPlansByScene(sceneId: string): CameraDirectorRecord[];
    getCameraPlansByStoryboard(storyboardId: string): CameraDirectorRecord[];
    searchCameraPlans(query: CameraDirectorSearchQuery): CameraDirectorRecord[];
    repairCameraPlan(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<CameraDirectorResult | null>;
    buildStatusReport(): CameraDirectorEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=camera-director-engine.d.ts.map