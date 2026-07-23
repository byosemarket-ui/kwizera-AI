import { AudioGenerationQualityMetadata, AudioGenerationValidationResult } from "./types.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationRegistry } from "./audio-generation-registry.js";
export declare class AudioGenerationQualityValidator {
    private readonly logger;
    private readonly registry;
    private validationTimes;
    constructor(logger: AudioGenerationFoundationLogger, registry: AudioGenerationRegistry);
    validateMetadata(metadata: AudioGenerationQualityMetadata): AudioGenerationValidationResult;
    validateModule(moduleId: string): AudioGenerationValidationResult;
    getAverageValidationMs(): number;
}
//# sourceMappingURL=audio-generation-quality-validator.d.ts.map