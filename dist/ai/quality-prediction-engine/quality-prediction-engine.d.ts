import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import { QualityPredictionLogger } from "./quality-prediction-logger.js";
import { QualityPredictionRecordStore } from "./quality-prediction-stores.js";
import { QualityPredictionEngineStatusReport, QualityPredictionInput, QualityPredictionRecord, QualityPredictionResult, QualityPredictionSearchQuery } from "./types.js";
/**
 * Quality Prediction Engine — evaluates expected quality, consistency and
 * production readiness before image or video generation begins.
 */
export declare class AiQualityPredictionEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: QualityPredictionLogger;
    readonly records: QualityPredictionRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private predictionTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    predictQuality(input: QualityPredictionInput): Promise<QualityPredictionResult>;
    getQualityPrediction(predictionId: string): QualityPredictionRecord | null;
    getQualityPredictionsByProduct(productId: string): QualityPredictionRecord[];
    searchQualityPredictions(query: QualityPredictionSearchQuery): QualityPredictionRecord[];
    detectRelationships(predictionId: string): QualityPredictionRecord["relationships"] | null;
    repairQualityPrediction(productId: string, platform?: CreativePlatform): Promise<QualityPredictionResult | null>;
    buildStatusReport(): QualityPredictionEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=quality-prediction-engine.d.ts.map