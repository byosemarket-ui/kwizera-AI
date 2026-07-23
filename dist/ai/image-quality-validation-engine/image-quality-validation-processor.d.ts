import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import { ImageQualityValidationAnalyzer } from "./image-quality-validation-analyzer.js";
import { ImageQualityValidationLinker } from "./image-quality-validation-linker.js";
import { ImageQualityValidationLogger } from "./image-quality-validation-logger.js";
import { ImageQualityValidationScorer } from "./image-quality-validation-scorer.js";
import { ImageQualityValidationRecordStore } from "./image-quality-validation-stores.js";
import { ImageQualityValidationInput, ImageQualityValidationRecord, ImageQualityValidationResult, ImageQualityValidationSearchQuery } from "./types.js";
export declare class ImageQualityValidationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiImageGenerationFoundation, analyzer: ImageQualityValidationAnalyzer, scorer: ImageQualityValidationScorer, linker: ImageQualityValidationLinker, records: ImageQualityValidationRecordStore, logger: ImageQualityValidationLogger);
    validateQuality(input: ImageQualityValidationInput): Promise<ImageQualityValidationResult>;
    search(query: ImageQualityValidationSearchQuery): ImageQualityValidationRecord[];
    private resolveContext;
    private registerValidationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=image-quality-validation-processor.d.ts.map