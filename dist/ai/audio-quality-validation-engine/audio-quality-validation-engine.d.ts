import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { AudioQualityValidationLogger } from "./audio-quality-validation-logger.js";
import { AudioQualityValidationRecordStore } from "./audio-quality-validation-stores.js";
import { AudioQualityValidationEngineStatusReport, AudioQualityValidationInput, AudioQualityValidationPlatform, AudioQualityValidationRecord, AudioQualityValidationResult, AudioQualityValidationSearchQuery } from "./types.js";
/**
 * AI Audio Quality Validation Engine — validates every audio production component
 * before rendering and export.
 */
export declare class AiAudioQualityValidationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: AudioQualityValidationLogger;
    readonly records: AudioQualityValidationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private validationTimes;
    private searchTimes;
    private repairTimes;
    initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    validateAudioQuality(input: AudioQualityValidationInput): Promise<AudioQualityValidationResult>;
    getValidation(audioQualityValidationId: string): AudioQualityValidationRecord | null;
    getValidationsByProduct(productId: string): AudioQualityValidationRecord[];
    searchValidations(query: AudioQualityValidationSearchQuery): AudioQualityValidationRecord[];
    repairAndRevalidate(productId: string, platform?: AudioQualityValidationPlatform): Promise<AudioQualityValidationResult | null>;
    buildStatusReport(): AudioQualityValidationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=audio-quality-validation-engine.d.ts.map