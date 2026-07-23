import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { AudioEnhancementRestorationLogger } from "./audio-enhancement-restoration-logger.js";
import { AudioEnhancementRestorationRecordStore } from "./audio-enhancement-restoration-stores.js";
import { AudioEnhancementGenerationEngineStatusReport, AudioEnhancementGenerationInput, AudioEnhancementGenerationRecord, AudioEnhancementGenerationResult, AudioEnhancementSearchQuery, AudioEnhancementPlatform, AudioEnhancementType } from "./types.js";
/**
 * AI Audio Enhancement & Restoration Engine — prepares production-ready audio
 * enhancement and restoration blueprints preserving clarity and quality.
 */
export declare class AiAudioEnhancementRestorationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: AudioEnhancementRestorationLogger;
    readonly records: AudioEnhancementRestorationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private blueprintTimes;
    initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateEnhancementPlan(input: AudioEnhancementGenerationInput): Promise<AudioEnhancementGenerationResult>;
    getEnhancementPlan(enhancementPlanId: string): AudioEnhancementGenerationRecord | null;
    getEnhancementPlansByProduct(productId: string): AudioEnhancementGenerationRecord[];
    getEnhancementPlansByType(enhancementType: AudioEnhancementType): AudioEnhancementGenerationRecord[];
    searchEnhancementPlans(query: AudioEnhancementSearchQuery): AudioEnhancementGenerationRecord[];
    repairEnhancementPlan(productId: string, platform?: AudioEnhancementPlatform): Promise<AudioEnhancementGenerationResult | null>;
    buildStatusReport(): AudioEnhancementGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=audio-enhancement-restoration-engine.d.ts.map