import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageProductionLogger } from "./image-production-logger.js";
import { ImageProductionRecordStore } from "./image-production-stores.js";
import { ImageProductionEngineStatusReport, ImageProductionInput, ImageProductionPlatform, ImageProductionRecord, ImageProductionResult, ImageProductionSearchQuery } from "./types.js";
/**
 * AI Image Production Engine — transforms approved image generation plans
 * into complete production-ready execution blueprints.
 */
export declare class AiImageProductionEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageProductionLogger;
    readonly records: ImageProductionRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private planningTimes;
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateProductionPlan(input: ImageProductionInput): Promise<ImageProductionResult>;
    getProductionPlan(imageProductionId: string): ImageProductionRecord | null;
    getProductionPlansByProduct(productId: string): ImageProductionRecord[];
    searchProductionPlans(query: ImageProductionSearchQuery): ImageProductionRecord[];
    repairProductionPlan(productId: string, platform?: ImageProductionPlatform): Promise<ImageProductionResult | null>;
    buildStatusReport(): ImageProductionEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=image-production-engine.d.ts.map