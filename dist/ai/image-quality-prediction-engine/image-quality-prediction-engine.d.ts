import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageQualityPredictionLogger } from "./image-quality-prediction-logger.js";
import { ImageQualityPredictionRecordStore } from "./image-quality-prediction-stores.js";
import { ImageQualityPredictionEngineStatusReport, ImageQualityPredictionInput, ImageQualityPredictionRecord, ImageQualityPredictionResult, ImageQualityPredictionSearchQuery } from "./types.js";
/**
 * Image Quality Prediction Engine — evaluates expected quality and production readiness before generation.
 */
export declare class AiImageQualityPredictionEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageQualityPredictionLogger;
    readonly records: ImageQualityPredictionRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private predictionTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    predictQuality(input: ImageQualityPredictionInput): Promise<ImageQualityPredictionResult>;
    getQualityPrediction(imageId: string): ImageQualityPredictionRecord | null;
    searchQualityPredictions(query: ImageQualityPredictionSearchQuery): ImageQualityPredictionRecord[];
    detectRelationships(imageId: string): ImageQualityPredictionRecord["relationships"] | null;
    repairQualityPrediction(imageId: string): Promise<ImageQualityPredictionResult | null>;
    buildStatusReport(): ImageQualityPredictionEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=image-quality-prediction-engine.d.ts.map