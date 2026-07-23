import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { TextToSpeechGenerationLogger } from "./text-to-speech-generation-logger.js";
import { TextToSpeechGenerationRecordStore } from "./text-to-speech-generation-stores.js";
import { TextToSpeechGenerationEngineStatusReport, TextToSpeechGenerationInput, TextToSpeechGenerationRecord, TextToSpeechGenerationResult, TextToSpeechSearchQuery, TtsLanguage, TtsPlatform } from "./types.js";
/**
 * AI Text-to-Speech Generation Engine — transforms structured text into
 * production-ready speech generation blueprints.
 */
export declare class AiTextToSpeechGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: TextToSpeechGenerationLogger;
    readonly records: TextToSpeechGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private blueprintTimes;
    initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateSpeechPlan(input: TextToSpeechGenerationInput): Promise<TextToSpeechGenerationResult>;
    getSpeechPlan(speechPlanId: string): TextToSpeechGenerationRecord | null;
    getSpeechPlansByProduct(productId: string): TextToSpeechGenerationRecord[];
    getSpeechPlansByProject(projectId: string): TextToSpeechGenerationRecord[];
    getSpeechPlansByLanguage(language: TtsLanguage): TextToSpeechGenerationRecord[];
    searchSpeechPlans(query: TextToSpeechSearchQuery): TextToSpeechGenerationRecord[];
    repairSpeechPlan(productId: string, platform?: TtsPlatform): Promise<TextToSpeechGenerationResult | null>;
    buildStatusReport(): TextToSpeechGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=text-to-speech-generation-engine.d.ts.map