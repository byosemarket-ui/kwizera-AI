import { ImageGenerationQualityMetadata, ImageGenerationValidationResult } from "./types.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationRegistry } from "./image-generation-registry.js";
export declare class ImageGenerationQualityValidator {
    private readonly logger;
    private readonly registry;
    private validationTimes;
    constructor(logger: ImageGenerationFoundationLogger, registry: ImageGenerationRegistry);
    validateMetadata(metadata: ImageGenerationQualityMetadata): ImageGenerationValidationResult;
    validateModule(moduleId: string): ImageGenerationValidationResult;
    getAverageValidationMs(): number;
}
//# sourceMappingURL=image-generation-quality-validator.d.ts.map