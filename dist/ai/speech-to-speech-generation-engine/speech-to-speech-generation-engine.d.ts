import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { SpeechToSpeechGenerationLogger } from "./speech-to-speech-generation-logger.js";
import { SpeechToSpeechGenerationRecordStore } from "./speech-to-speech-generation-stores.js";
import { S2sLanguage, S2sPlatform, SpeechToSpeechGenerationEngineStatusReport, SpeechToSpeechGenerationInput, SpeechToSpeechGenerationRecord, SpeechToSpeechGenerationResult, SpeechToSpeechSearchQuery } from "./types.js";
/**
 * AI Speech-to-Speech Generation Engine — transforms spoken audio into
 * production-ready speech transformation blueprints.
 */
export declare class AiSpeechToSpeechGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: SpeechToSpeechGenerationLogger;
    readonly records: SpeechToSpeechGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private blueprintTimes;
    initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateTransformationPlan(input: SpeechToSpeechGenerationInput): Promise<SpeechToSpeechGenerationResult>;
    getTransformationPlan(transformationId: string): SpeechToSpeechGenerationRecord | null;
    getTransformationsBySourceAudio(sourceAudioId: string): SpeechToSpeechGenerationRecord[];
    getTransformationsByProduct(productId: string): SpeechToSpeechGenerationRecord[];
    getTransformationsByLanguage(language: S2sLanguage): SpeechToSpeechGenerationRecord[];
    searchTransformationPlans(query: SpeechToSpeechSearchQuery): SpeechToSpeechGenerationRecord[];
    repairTransformationPlan(productId: string, platform?: S2sPlatform): Promise<SpeechToSpeechGenerationResult | null>;
    buildStatusReport(): SpeechToSpeechGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=speech-to-speech-generation-engine.d.ts.map