import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { AudioRenderLogger } from "./audio-render-logger.js";
import { AudioRenderRecordStore } from "./audio-render-stores.js";
import { AudioRenderEngineStatusReport, AudioRenderInput, AudioRenderPlatform, AudioRenderRecord, AudioRenderResult, AudioRenderSearchQuery } from "./types.js";
/**
 * AI Audio Rendering Preparation Engine — validates and prepares assets, tracks,
 * timelines and production instructions before audio rendering begins.
 */
export declare class AiAudioRenderingPreparationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: AudioRenderLogger;
    readonly records: AudioRenderRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private planningTimes;
    initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateRenderPlan(input: AudioRenderInput): Promise<AudioRenderResult>;
    getRenderPlan(audioRenderPlanId: string): AudioRenderRecord | null;
    getRenderPlansByProduction(productionId: string): AudioRenderRecord[];
    getRenderPlansByProduct(productId: string): AudioRenderRecord[];
    searchRenderPlans(query: AudioRenderSearchQuery): AudioRenderRecord[];
    repairRenderPlan(productId: string, platform?: AudioRenderPlatform): Promise<AudioRenderResult | null>;
    buildStatusReport(): AudioRenderEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=audio-rendering-preparation-engine.d.ts.map