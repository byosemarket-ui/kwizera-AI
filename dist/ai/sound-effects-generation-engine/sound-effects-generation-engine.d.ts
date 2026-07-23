import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { SoundEffectsGenerationLogger } from "./sound-effects-generation-logger.js";
import { SoundEffectsGenerationRecordStore } from "./sound-effects-generation-stores.js";
import { SoundCategory, SoundEffectsGenerationEngineStatusReport, SoundEffectsGenerationInput, SoundEffectsGenerationRecord, SoundEffectsGenerationResult, SoundEffectsSearchQuery, SfxPlatform } from "./types.js";
/**
 * AI Sound Effects Generation Engine — prepares production-ready sound effect
 * blueprints while maintaining realism, synchronization, and production quality.
 */
export declare class AiSoundEffectsGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: SoundEffectsGenerationLogger;
    readonly records: SoundEffectsGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private blueprintTimes;
    initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateSoundEffectPlan(input: SoundEffectsGenerationInput): Promise<SoundEffectsGenerationResult>;
    getSoundEffectPlan(soundPlanId: string): SoundEffectsGenerationRecord | null;
    getSoundEffectPlansByProduct(productId: string): SoundEffectsGenerationRecord[];
    getSoundEffectPlansByCategory(category: SoundCategory): SoundEffectsGenerationRecord[];
    searchSoundEffectPlans(query: SoundEffectsSearchQuery): SoundEffectsGenerationRecord[];
    repairSoundEffectPlan(productId: string, platform?: SfxPlatform): Promise<SoundEffectsGenerationResult | null>;
    buildStatusReport(): SoundEffectsGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=sound-effects-generation-engine.d.ts.map