import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { BackgroundGenerationLogger } from "./background-generation-logger.js";
import { BackgroundGenerationRecordStore } from "./background-generation-stores.js";
import { BackgroundGenerationEngineStatusReport, BackgroundGenerationInput, BackgroundGenerationRecord, BackgroundGenerationResult, BackgroundGenPlatform, BackgroundGenerationSearchQuery } from "./types.js";
/**
 * AI Background Generation & Replacement Engine — intelligently generates, replaces
 * and optimizes backgrounds while preserving subject integrity and brand identity.
 */
export declare class AiBackgroundGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: BackgroundGenerationLogger;
    readonly records: BackgroundGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private analysisTimes;
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateBackgroundPlan(input: BackgroundGenerationInput): Promise<BackgroundGenerationResult>;
    getBackgroundPlan(backgroundPlanId: string): BackgroundGenerationRecord | null;
    getBackgroundPlansByProduct(productId: string): BackgroundGenerationRecord[];
    getBackgroundPlansBySourceImage(sourceImageId: string): BackgroundGenerationRecord[];
    searchBackgroundPlans(query: BackgroundGenerationSearchQuery): BackgroundGenerationRecord[];
    repairBackgroundPlan(sourceImageId: string, platform?: BackgroundGenPlatform): Promise<BackgroundGenerationResult | null>;
    buildStatusReport(): BackgroundGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=background-generation-engine.d.ts.map