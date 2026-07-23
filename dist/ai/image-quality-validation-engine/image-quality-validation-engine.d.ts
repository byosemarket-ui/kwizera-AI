import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageQualityValidationLogger } from "./image-quality-validation-logger.js";
import { ImageQualityValidationRecordStore } from "./image-quality-validation-stores.js";
import { ImageQualityValidationEngineStatusReport, ImageQualityValidationInput, ImageQualityValidationRecord, ImageQualityValidationResult, ImageQualityValidationSearchQuery, QualityValidationPlatform } from "./types.js";
/**
 * AI Image Quality Validation Engine — validates every image production component
 * before rendering and export.
 */
export declare class AiImageQualityValidationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: ImageQualityValidationLogger;
    readonly records: ImageQualityValidationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private validationTimes;
    private searchTimes;
    private repairTimes;
    initialize(foundation: AiImageGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    validateQuality(input: ImageQualityValidationInput): Promise<ImageQualityValidationResult>;
    getValidation(qualityValidationId: string): ImageQualityValidationRecord | null;
    getValidationsByProduct(productId: string): ImageQualityValidationRecord[];
    searchValidations(query: ImageQualityValidationSearchQuery): ImageQualityValidationRecord[];
    repairAndRevalidate(productId: string, platform?: QualityValidationPlatform): Promise<ImageQualityValidationResult | null>;
    buildStatusReport(): ImageQualityValidationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=image-quality-validation-engine.d.ts.map