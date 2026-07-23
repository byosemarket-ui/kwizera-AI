import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { VideoQualityValidationAnalyzer } from "./video-quality-validation-analyzer.js";
import { VideoQualityValidationLinker } from "./video-quality-validation-linker.js";
import { VideoQualityValidationLogger } from "./video-quality-validation-logger.js";
import { VideoQualityValidationScorer } from "./video-quality-validation-scorer.js";
import { QualityValidationRecordStore } from "./video-quality-validation-stores.js";
import { QualityValidationInput, QualityValidationRecord, QualityValidationResult, QualityValidationSearchQuery } from "./types.js";
export declare class VideoQualityValidationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, analyzer: VideoQualityValidationAnalyzer, scorer: VideoQualityValidationScorer, linker: VideoQualityValidationLinker, records: QualityValidationRecordStore, logger: VideoQualityValidationLogger);
    validateVideoQuality(input: QualityValidationInput): Promise<QualityValidationResult>;
    search(query: QualityValidationSearchQuery): QualityValidationRecord[];
    private resolveBundles;
    private registerGenerationAsset;
    private applySafeRepairs;
    private markIssuesRepaired;
    private reject;
}
//# sourceMappingURL=video-quality-validation-processor.d.ts.map