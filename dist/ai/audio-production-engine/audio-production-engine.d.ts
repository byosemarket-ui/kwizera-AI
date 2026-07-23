import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { AudioProductionLogger } from "./audio-production-logger.js";
import { AudioProductionRecordStore } from "./audio-production-stores.js";
import { AudioProductionEngineStatusReport, AudioProductionInput, AudioProductionRecord, AudioProductionResult, AudioProductionSearchQuery, AudioProductionPlatform } from "./types.js";
/**
 * AI Audio Production Engine — transforms approved audio generation plans
 * into complete production-ready execution blueprints.
 */
export declare class AiAudioProductionEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: AudioProductionLogger;
    readonly records: AudioProductionRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private planningTimes;
    initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateProductionPlan(input: AudioProductionInput): Promise<AudioProductionResult>;
    getProductionPlan(audioProductionId: string): AudioProductionRecord | null;
    getProductionPlansByProduct(productId: string): AudioProductionRecord[];
    getProductionPlansByAudioPlan(audioPlanId: string): AudioProductionRecord[];
    searchProductionPlans(query: AudioProductionSearchQuery): AudioProductionRecord[];
    repairProductionPlan(productId: string, platform?: AudioProductionPlatform): Promise<AudioProductionResult | null>;
    buildStatusReport(): AudioProductionEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=audio-production-engine.d.ts.map