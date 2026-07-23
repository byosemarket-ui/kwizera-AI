import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { AmbientAudioGenerationLogger } from "./ambient-audio-generation-logger.js";
import { AmbientAudioGenerationRecordStore } from "./ambient-audio-generation-stores.js";
import { AmbientAudioGenerationEngineStatusReport, AmbientAudioGenerationInput, AmbientAudioGenerationRecord, AmbientAudioGenerationResult, AmbientAudioSearchQuery, AmbientPlatform, EnvironmentCategory } from "./types.js";
/**
 * AI Ambient & Environmental Audio Engine — prepares production-ready ambient
 * and environmental audio blueprints with realism, immersion, and sync quality.
 */
export declare class AiAmbientAudioGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: AmbientAudioGenerationLogger;
    readonly records: AmbientAudioGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private blueprintTimes;
    initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateAmbientPlan(input: AmbientAudioGenerationInput): Promise<AmbientAudioGenerationResult>;
    getAmbientPlan(ambientPlanId: string): AmbientAudioGenerationRecord | null;
    getAmbientPlansByProduct(productId: string): AmbientAudioGenerationRecord[];
    getAmbientPlansByCategory(category: EnvironmentCategory): AmbientAudioGenerationRecord[];
    searchAmbientPlans(query: AmbientAudioSearchQuery): AmbientAudioGenerationRecord[];
    repairAmbientPlan(productId: string, platform?: AmbientPlatform): Promise<AmbientAudioGenerationResult | null>;
    buildStatusReport(): AmbientAudioGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=ambient-audio-generation-engine.d.ts.map