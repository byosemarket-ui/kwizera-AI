import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { MultiStyleImageLogger } from "./multi-style-image-logger.js";
import { MultiStyleImageRecordStore } from "./multi-style-image-stores.js";
import { MultiStyleGenPlatform, MultiStyleImageEngineStatusReport, MultiStyleImageInput, MultiStyleImageRecord, MultiStyleImageResult, MultiStyleImageSearchQuery } from "./types.js";
/**
 * AI Multi-Style Image Generation Engine — generates production-ready style blueprints
 * across multiple artistic, commercial and marketing styles.
 */
export declare class AiMultiStyleImageGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: MultiStyleImageLogger;
    readonly records: MultiStyleImageRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private planningTimes;
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateStylePlan(input: MultiStyleImageInput): Promise<MultiStyleImageResult>;
    getStylePlan(stylePlanId: string): MultiStyleImageRecord | null;
    getStylePlansByProduct(productId: string): MultiStyleImageRecord[];
    searchStylePlans(query: MultiStyleImageSearchQuery): MultiStyleImageRecord[];
    repairStylePlan(productId: string, platform?: MultiStyleGenPlatform): Promise<MultiStyleImageResult | null>;
    buildStatusReport(): MultiStyleImageEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=multi-style-image-generation-engine.d.ts.map