import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { BrandingDesignLogger } from "./branding-design-logger.js";
import { BrandingDesignRecordStore } from "./branding-design-stores.js";
import { BrandDesignGenPlatform, BrandingDesignEngineStatusReport, BrandingDesignInput, BrandingDesignRecord, BrandingDesignResult, BrandingDesignSearchQuery } from "./types.js";
/**
 * AI Branding & Graphic Design Engine — generates professional branding assets
 * and graphic design blueprints while maintaining brand consistency and production readiness.
 */
export declare class AiBrandingDesignEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: BrandingDesignLogger;
    readonly records: BrandingDesignRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private planningTimes;
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateBrandingPlan(input: BrandingDesignInput): Promise<BrandingDesignResult>;
    getBrandingPlan(brandDesignId: string): BrandingDesignRecord | null;
    getBrandingPlansByProduct(productId: string): BrandingDesignRecord[];
    getBrandingPlansByBrand(brandId: string): BrandingDesignRecord[];
    searchBrandingPlans(query: BrandingDesignSearchQuery): BrandingDesignRecord[];
    repairBrandingPlan(productId: string, platform?: BrandDesignGenPlatform): Promise<BrandingDesignResult | null>;
    buildStatusReport(): BrandingDesignEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=branding-design-engine.d.ts.map