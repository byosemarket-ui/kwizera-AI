import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { AudioMixingMasteringLogger } from "./audio-mixing-mastering-logger.js";
import { AudioMixingMasteringRecordStore } from "./audio-mixing-mastering-stores.js";
import { AudioMixMasterGenerationEngineStatusReport, AudioMixMasterGenerationInput, AudioMixMasterGenerationRecord, AudioMixMasterGenerationResult, AudioMixMasterSearchQuery, AudioMixingPlatform } from "./types.js";
/**
 * AI Audio Mixing & Mastering Engine — prepares production-ready mixing
 * and mastering blueprints preserving clarity, balance, and loudness.
 */
export declare class AiAudioMixingMasteringEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: AudioMixingMasteringLogger;
    readonly records: AudioMixingMasteringRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private blueprintTimes;
    initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateMixMasterPlan(input: AudioMixMasterGenerationInput): Promise<AudioMixMasterGenerationResult>;
    getMixMasterPlan(mixingPlanId: string): AudioMixMasterGenerationRecord | null;
    getMixMasterPlansByProduct(productId: string): AudioMixMasterGenerationRecord[];
    getMixMasterPlansBySession(sessionId: string): AudioMixMasterGenerationRecord[];
    searchMixMasterPlans(query: AudioMixMasterSearchQuery): AudioMixMasterGenerationRecord[];
    repairMixMasterPlan(productId: string, platform?: AudioMixingPlatform): Promise<AudioMixMasterGenerationResult | null>;
    buildStatusReport(): AudioMixMasterGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=audio-mixing-mastering-engine.d.ts.map