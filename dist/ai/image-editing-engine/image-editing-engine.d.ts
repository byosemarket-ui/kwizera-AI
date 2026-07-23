import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageEditingLogger } from "./image-editing-logger.js";
import { ImageEditingRecordStore } from "./image-editing-stores.js";
import { ImageEditingEngineStatusReport, ImageEditingInput, ImageEditingRecord, ImageEditingResult, ImageEditGenPlatform, ImageEditingSearchQuery } from "./types.js";
/**
 * AI Image Editing, Inpainting & Outpainting Engine — intelligent non-destructive
 * image editing while preserving subject identity, product consistency and brand integrity.
 */
export declare class AiImageEditingEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageEditingLogger;
    readonly records: ImageEditingRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private analysisTimes;
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateEditingPlan(input: ImageEditingInput): Promise<ImageEditingResult>;
    getEditingPlan(imageEditingPlanId: string): ImageEditingRecord | null;
    getEditingPlansByProduct(productId: string): ImageEditingRecord[];
    getEditingPlansBySourceImage(sourceImageId: string): ImageEditingRecord[];
    searchEditingPlans(query: ImageEditingSearchQuery): ImageEditingRecord[];
    repairEditingPlan(sourceImageId: string, platform?: ImageEditGenPlatform): Promise<ImageEditingResult | null>;
    buildStatusReport(): ImageEditingEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=image-editing-engine.d.ts.map