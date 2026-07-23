import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { AudioQualityValidationAnalyzer } from "./audio-quality-validation-analyzer.js";
import { AudioQualityValidationLinker } from "./audio-quality-validation-linker.js";
import { AudioQualityValidationLogger } from "./audio-quality-validation-logger.js";
import { AudioQualityValidationScorer } from "./audio-quality-validation-scorer.js";
import { AudioQualityValidationRecordStore } from "./audio-quality-validation-stores.js";
import { AudioQualityValidationInput, AudioQualityValidationRecord, AudioQualityValidationResult, AudioQualityValidationSearchQuery } from "./types.js";
export declare class AudioQualityValidationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiAudioGenerationFoundation, analyzer: AudioQualityValidationAnalyzer, scorer: AudioQualityValidationScorer, linker: AudioQualityValidationLinker, records: AudioQualityValidationRecordStore, logger: AudioQualityValidationLogger);
    validateAudioQuality(input: AudioQualityValidationInput): Promise<AudioQualityValidationResult>;
    search(query: AudioQualityValidationSearchQuery): AudioQualityValidationRecord[];
    private resolveContext;
    private registerValidationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=audio-quality-validation-processor.d.ts.map