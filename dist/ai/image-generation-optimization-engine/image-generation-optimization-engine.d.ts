import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageGenerationOptimizationLogger } from "./image-generation-optimization-logger.js";
import { ImageGenerationOptimizationRecordStore } from "./image-generation-optimization-stores.js";
import { ImageGenerationOptimizationEngineStatusReport, ImageGenerationOptimizationInput, ImageGenerationOptimizationRecord, ImageGenerationOptimizationResult, ImageGenerationOptimizationSearchQuery, OptimizationPlatform } from "./types.js";
/**
 * AI Image Generation Optimization Engine — optimizes the entire image generation
 * pipeline for quality, speed, reliability and production readiness.
 */
export declare class AiImageGenerationOptimizationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageGenerationOptimizationLogger;
    readonly records: ImageGenerationOptimizationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private optimizationTimes;
    private searchTimes;
    private repairTimes;
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    optimizeImageGeneration(input: ImageGenerationOptimizationInput): Promise<ImageGenerationOptimizationResult>;
    getOptimization(optimizationId: string): ImageGenerationOptimizationRecord | null;
    getOptimizationsByProduct(productId: string): ImageGenerationOptimizationRecord[];
    searchOptimizations(query: ImageGenerationOptimizationSearchQuery): ImageGenerationOptimizationRecord[];
    repairAndReoptimize(productId: string, platform?: OptimizationPlatform): Promise<ImageGenerationOptimizationResult | null>;
    buildStatusReport(): ImageGenerationOptimizationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=image-generation-optimization-engine.d.ts.map