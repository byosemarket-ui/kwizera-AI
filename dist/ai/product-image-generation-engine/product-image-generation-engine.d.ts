import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ProductImageGenerationLogger } from "./product-image-generation-logger.js";
import { ProductImageGenerationRecordStore } from "./product-image-generation-stores.js";
import { ProductImageGenerationEngineStatusReport, ProductImageGenerationInput, ProductImageGenerationRecord, ProductImageGenerationResult, ProductImageGenPlatform, ProductImageGenerationSearchQuery } from "./types.js";
/**
 * AI Product Image Generation Engine — prepares production-ready product image
 * generation blueprints for e-commerce, marketing, advertising and branding.
 */
export declare class AiProductImageGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ProductImageGenerationLogger;
    readonly records: ProductImageGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private planningTimes;
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateProductImagePlan(input: ProductImageGenerationInput): Promise<ProductImageGenerationResult>;
    getProductImagePlan(productImagePlanId: string): ProductImageGenerationRecord | null;
    getProductImagePlansByProduct(productId: string): ProductImageGenerationRecord[];
    getProductImagePlansByCategory(productCategory: string): ProductImageGenerationRecord[];
    searchProductImagePlans(query: ProductImageGenerationSearchQuery): ProductImageGenerationRecord[];
    repairProductImagePlan(productId: string, platform?: ProductImageGenPlatform): Promise<ProductImageGenerationResult | null>;
    buildStatusReport(): ProductImageGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=product-image-generation-engine.d.ts.map