import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ObjectDetectionLogger } from "./object-detection-logger.js";
import { ObjectDetectionRecordStore } from "./object-detection-stores.js";
import { ObjectDetectionEngineStatusReport, ObjectDetectionInput, ObjectDetectionRecord, ObjectDetectionResult, ObjectDetectionSearchQuery } from "./types.js";
/**
 * Object Detection Intelligence Engine — detects, classifies and organizes visual objects in images.
 */
export declare class AiObjectDetectionIntelligenceEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ObjectDetectionLogger;
    readonly records: ObjectDetectionRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private detectionTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    detectObjects(input: ObjectDetectionInput): Promise<ObjectDetectionResult>;
    getDetection(imageId: string): ObjectDetectionRecord | null;
    searchDetections(query: ObjectDetectionSearchQuery): ObjectDetectionRecord[];
    detectRelationships(imageId: string): ObjectDetectionRecord["relationships"] | null;
    repairDetection(imageId: string): Promise<ObjectDetectionResult | null>;
    buildStatusReport(): ObjectDetectionEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=object-detection-intelligence-engine.d.ts.map