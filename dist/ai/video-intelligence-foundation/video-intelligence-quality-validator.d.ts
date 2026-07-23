import { VideoIntelligenceQualityMetadata, VideoIntelligenceValidationResult } from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceRegistry } from "./video-intelligence-registry.js";
export declare class VideoIntelligenceQualityValidator {
    private readonly logger;
    private readonly registry;
    private validationTimes;
    constructor(logger: VideoIntelligenceFoundationLogger, registry: VideoIntelligenceRegistry);
    validateMetadata(metadata: VideoIntelligenceQualityMetadata): VideoIntelligenceValidationResult;
    validateModule(moduleId: string): VideoIntelligenceValidationResult;
    getAverageValidationMs(): number;
}
//# sourceMappingURL=video-intelligence-quality-validator.d.ts.map