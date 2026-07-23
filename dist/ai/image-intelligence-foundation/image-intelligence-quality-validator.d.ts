import { ImageIntelligenceQualityMetadata, ImageIntelligenceValidationResult } from "./types.js";
import { ImageIntelligenceFoundationLogger } from "./image-intelligence-logger.js";
import { ImageIntelligenceRegistry } from "./image-intelligence-registry.js";
export declare class ImageIntelligenceQualityValidator {
    private readonly logger;
    private readonly registry;
    private validationTimes;
    constructor(logger: ImageIntelligenceFoundationLogger, registry: ImageIntelligenceRegistry);
    validateMetadata(metadata: ImageIntelligenceQualityMetadata): ImageIntelligenceValidationResult;
    validateModule(moduleId: string): ImageIntelligenceValidationResult;
    getAverageValidationMs(): number;
}
//# sourceMappingURL=image-intelligence-quality-validator.d.ts.map