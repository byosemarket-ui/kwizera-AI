import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { CreativePlatform } from "../creative-direction-engine/types.js";
import { AudioPlanningLogger } from "./audio-planning-logger.js";
import { AudioPlanningRecordStore } from "./audio-planning-stores.js";
import { AudioPlanningEngineStatusReport, AudioPlanningInput, AudioPlanningRecord, AudioPlanningResult, AudioPlanningSearchQuery } from "./types.js";
/**
 * Audio Planning Engine — prepares complete audio production plans before
 * voice, music or sound effects generation, aligned with storyboard, script, visual plan, brand and strategy.
 */
export declare class AiAudioPlanningEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: AudioPlanningLogger;
    readonly records: AudioPlanningRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private planningTimes;
    private searchTimes;
    private relationshipTimes;
    initialize(foundation: AiProductIntelligenceFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    createAudioPlan(input: AudioPlanningInput): Promise<AudioPlanningResult>;
    getAudioPlan(audioPlanId: string): AudioPlanningRecord | null;
    getAudioPlansByProduct(productId: string): AudioPlanningRecord[];
    searchAudioPlans(query: AudioPlanningSearchQuery): AudioPlanningRecord[];
    detectRelationships(audioPlanId: string): AudioPlanningRecord["relationships"] | null;
    repairAudioPlan(productId: string, platform?: CreativePlatform): Promise<AudioPlanningResult | null>;
    buildStatusReport(): AudioPlanningEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=audio-planning-engine.d.ts.map