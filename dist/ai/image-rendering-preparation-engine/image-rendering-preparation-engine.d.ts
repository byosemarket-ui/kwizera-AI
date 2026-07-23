import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageRenderLogger } from "./image-render-logger.js";
import { ImageRenderRecordStore } from "./image-render-stores.js";
import { ImageRenderEngineStatusReport, ImageRenderInput, ImageRenderPlatform, ImageRenderRecord, ImageRenderResult, ImageRenderSearchQuery } from "./types.js";
/**
 * AI Image Rendering Preparation Engine — validates and prepares assets, layers,
 * masks and production instructions before rendering begins.
 */
export declare class AiImageRenderingPreparationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageRenderLogger;
    readonly records: ImageRenderRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private planningTimes;
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateRenderPlan(input: ImageRenderInput): Promise<ImageRenderResult>;
    getRenderPlan(imageRenderPlanId: string): ImageRenderRecord | null;
    getRenderPlansByProduction(productionId: string): ImageRenderRecord[];
    getRenderPlansByProduct(productId: string): ImageRenderRecord[];
    searchRenderPlans(query: ImageRenderSearchQuery): ImageRenderRecord[];
    repairRenderPlan(productId: string, platform?: ImageRenderPlatform): Promise<ImageRenderResult | null>;
    buildStatusReport(): ImageRenderEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=image-rendering-preparation-engine.d.ts.map