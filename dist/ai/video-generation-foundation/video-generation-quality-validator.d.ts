import { VideoGenerationQualityMetadata, VideoGenerationValidationResult } from "./types.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationRegistry } from "./video-generation-registry.js";
export declare class VideoGenerationQualityValidator {
    private readonly logger;
    private readonly registry;
    private validationTimes;
    constructor(logger: VideoGenerationFoundationLogger, registry: VideoGenerationRegistry);
    validateMetadata(metadata: VideoGenerationQualityMetadata): VideoGenerationValidationResult;
    validateModule(moduleId: string): VideoGenerationValidationResult;
    getAverageValidationMs(): number;
}
//# sourceMappingURL=video-generation-quality-validator.d.ts.map