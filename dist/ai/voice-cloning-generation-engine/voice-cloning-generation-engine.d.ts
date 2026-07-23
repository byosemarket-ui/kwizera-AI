import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { VoiceCloningGenerationLogger } from "./voice-cloning-generation-logger.js";
import { VoiceCloningGenerationRecordStore } from "./voice-cloning-generation-stores.js";
import { VcLanguage, VcPlatform, VoiceCloningGenerationEngineStatusReport, VoiceCloningGenerationInput, VoiceCloningGenerationRecord, VoiceCloningGenerationResult, VoiceCloningSearchQuery } from "./types.js";
/**
 * AI Voice Cloning Generation Engine — prepares secure, production-ready
 * voice cloning blueprints while preserving identity, quality, and compliance.
 */
export declare class AiVoiceCloningGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: VoiceCloningGenerationLogger;
    readonly records: VoiceCloningGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private blueprintTimes;
    initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateCloningPlan(input: VoiceCloningGenerationInput): Promise<VoiceCloningGenerationResult>;
    getCloningPlan(cloningPlanId: string): VoiceCloningGenerationRecord | null;
    getCloningPlansByVoiceSample(voiceSampleId: string): VoiceCloningGenerationRecord[];
    getCloningPlansBySpeaker(speakerId: string): VoiceCloningGenerationRecord[];
    getCloningPlansByProduct(productId: string): VoiceCloningGenerationRecord[];
    getCloningPlansByLanguage(language: VcLanguage): VoiceCloningGenerationRecord[];
    searchCloningPlans(query: VoiceCloningSearchQuery): VoiceCloningGenerationRecord[];
    repairCloningPlan(productId: string, platform?: VcPlatform): Promise<VoiceCloningGenerationResult | null>;
    buildStatusReport(): VoiceCloningGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=voice-cloning-generation-engine.d.ts.map