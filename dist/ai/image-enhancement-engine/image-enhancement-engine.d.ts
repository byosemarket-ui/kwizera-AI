import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageEnhancementLogger } from "./image-enhancement-logger.js";
import { ImageEnhancementRecordStore } from "./image-enhancement-stores.js";
import { ImageEnhanceGenPlatform, ImageEnhancementEngineStatusReport, ImageEnhancementInput, ImageEnhancementRecord, ImageEnhancementResult, ImageEnhancementSearchQuery } from "./types.js";
/**
 * AI Image Enhancement & Restoration Engine — intelligently improves image quality,
 * restores damaged images and prepares production-ready enhancement blueprints.
 */
export declare class AiImageEnhancementEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageEnhancementLogger;
    readonly records: ImageEnhancementRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private analysisTimes;
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateEnhancementPlan(input: ImageEnhancementInput): Promise<ImageEnhancementResult>;
    getEnhancementPlan(enhancementPlanId: string): ImageEnhancementRecord | null;
    getEnhancementPlansByProduct(productId: string): ImageEnhancementRecord[];
    getEnhancementPlansBySourceImage(sourceImageId: string): ImageEnhancementRecord[];
    searchEnhancementPlans(query: ImageEnhancementSearchQuery): ImageEnhancementRecord[];
    repairEnhancementPlan(sourceImageId: string, platform?: ImageEnhanceGenPlatform): Promise<ImageEnhancementResult | null>;
    buildStatusReport(): ImageEnhancementEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=image-enhancement-engine.d.ts.map