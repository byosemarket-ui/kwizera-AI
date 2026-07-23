import type { AiVideoIntelligenceFoundation } from "../video-intelligence-foundation/video-intelligence-foundation.js";
import { CameraMovementLogger } from "./camera-movement-logger.js";
import { CameraMovementRecordStore } from "./camera-movement-stores.js";
import { CameraAngle, CameraMovementEngineStatusReport, CameraMovementInput, CameraMovementRecord, CameraMovementResult, CameraMovementSearchQuery, CameraMovementType, ShotFraming } from "./types.js";
/**
 * Camera Movement Intelligence Engine — analyzes, classifies and plans camera movements in videos.
 */
export declare class AiCameraMovementIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: CameraMovementLogger;
    readonly records: CameraMovementRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private analysisTimes;
    private searchTimes;
    initialize(foundation: AiVideoIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    analyzeCamera(input: CameraMovementInput): Promise<CameraMovementResult>;
    getCameraAnalysis(videoId: string): CameraMovementRecord | null;
    searchCameraAnalysis(query: CameraMovementSearchQuery): CameraMovementRecord[];
    repairCameraAnalysis(videoId: string): Promise<CameraMovementResult | null>;
    buildStatusReport(): CameraMovementEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
export { CameraMovementType, CameraAngle, ShotFraming };
//# sourceMappingURL=camera-movement-intelligence-engine.d.ts.map