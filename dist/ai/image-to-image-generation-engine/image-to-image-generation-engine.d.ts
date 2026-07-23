import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageToImageGenerationLogger } from "./image-to-image-generation-logger.js";
import { ImageToImageGenerationRecordStore } from "./image-to-image-generation-stores.js";
import { ImageToImageGenerationEngineStatusReport, ImageToImageGenerationInput, ImageToImageGenerationRecord, ImageToImageGenerationResult, ImageToImagePlatform, ImageToImageSearchQuery } from "./types.js";
/**
 * AI Image-to-Image Generation Engine — transforms existing images into
 * production-ready transformation blueprints while preserving identity and brand consistency.
 */
export declare class AiImageToImageGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageToImageGenerationLogger;
    readonly records: ImageToImageGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private analysisTimes;
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateTransformationPlan(input: ImageToImageGenerationInput): Promise<ImageToImageGenerationResult>;
    getTransformationPlan(transformationPlanId: string): ImageToImageGenerationRecord | null;
    getTransformationPlansBySourceImage(sourceImageId: string): ImageToImageGenerationRecord[];
    getTransformationPlansByProduct(productId: string): ImageToImageGenerationRecord[];
    searchTransformationPlans(query: ImageToImageSearchQuery): ImageToImageGenerationRecord[];
    repairTransformationPlan(sourceImageId: string, platform?: ImageToImagePlatform): Promise<ImageToImageGenerationResult | null>;
    buildStatusReport(): ImageToImageGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=image-to-image-generation-engine.d.ts.map