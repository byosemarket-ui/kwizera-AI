import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import type { ImageQualityPredictionPlatform } from "../image-quality-prediction-engine/types.js";
import { ImageIntelligenceOptimizationLogger } from "./image-intelligence-optimization-logger.js";
import { ImageIntelligenceOptimizationRecordStore } from "./image-intelligence-optimization-stores.js";
import { ImageIntelligenceOptimizationEngineStatusReport, ImageIntelligenceOptimizationInput, ImageIntelligenceOptimizationRecord, ImageIntelligenceOptimizationResult, ImageIntelligenceOptimizationSearchQuery } from "./types.js";
/**
 * Image Intelligence Optimization Engine — continuously improves quality,
 * speed, consistency and efficiency across all Image Intelligence modules.
 */
export declare class AiImageIntelligenceOptimizationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageIntelligenceOptimizationLogger;
    readonly records: ImageIntelligenceOptimizationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private optimizationTimes;
    private searchTimes;
    private recoveryTimes;
    initialize(foundation: AiImageIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    runOptimization(input: ImageIntelligenceOptimizationInput): Promise<ImageIntelligenceOptimizationResult>;
    getOptimization(optimizationId: string): ImageIntelligenceOptimizationRecord | null;
    getOptimizationsByImage(imageId: string): ImageIntelligenceOptimizationRecord[];
    searchOptimizations(query: ImageIntelligenceOptimizationSearchQuery): ImageIntelligenceOptimizationRecord[];
    restoreRecoveryPoint(recoveryId: string): boolean;
    repairOptimization(imageId: string, _platform?: ImageQualityPredictionPlatform): Promise<ImageIntelligenceOptimizationResult | null>;
    getCache(): import("./types.js").ImageCacheOptimization;
    buildStatusReport(): ImageIntelligenceOptimizationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=image-intelligence-optimization-engine.d.ts.map