import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { SceneDetectionLogger } from "./scene-detection-logger.js";
import { SceneDetectionRecordStore } from "./scene-detection-stores.js";
import { SceneClassification, SceneDetectionEngineStatusReport, SceneDetectionInput, SceneDetectionRecord, SceneDetectionResult, SceneDetectionSearchQuery, ShotType, TransitionType } from "./types.js";
/**
 * Scene Detection Intelligence Engine — detects, organizes and understands scenes, shots and transitions.
 */
export declare class AiSceneDetectionIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: SceneDetectionLogger;
    readonly records: SceneDetectionRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private detectionTimes;
    private searchTimes;
    private indexingTimes;
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    detectScenes(input: SceneDetectionInput): Promise<SceneDetectionResult>;
    getDetection(videoId: string): SceneDetectionRecord | null;
    searchDetections(query: SceneDetectionSearchQuery): SceneDetectionRecord[];
    detectRelationships(videoId: string): SceneDetectionRecord["relationships"] | null;
    repairDetection(videoId: string): Promise<SceneDetectionResult | null>;
    buildStatusReport(): SceneDetectionEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    getEngineDir(): string;
    private ensureReady;
}
export { SceneClassification, ShotType, TransitionType };
//# sourceMappingURL=scene-detection-intelligence-engine.d.ts.map