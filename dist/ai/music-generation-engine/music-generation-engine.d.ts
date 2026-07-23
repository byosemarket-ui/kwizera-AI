import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { MusicGenerationLogger } from "./music-generation-logger.js";
import { MusicGenerationRecordStore } from "./music-generation-stores.js";
import { MusicGenre, MusicGenerationEngineStatusReport, MusicGenerationInput, MusicGenerationRecord, MusicGenerationResult, MusicMood, MusicPlatform, MusicSearchQuery } from "./types.js";
/**
 * AI Music Generation Engine — prepares production-ready music generation
 * blueprints while maintaining quality, emotional consistency, and brand identity.
 */
export declare class AiMusicGenerationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: MusicGenerationLogger;
    readonly records: MusicGenerationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private generationTimes;
    private searchTimes;
    private blueprintTimes;
    initialize(foundation: AiAudioGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateMusicPlan(input: MusicGenerationInput): Promise<MusicGenerationResult>;
    getMusicPlan(musicPlanId: string): MusicGenerationRecord | null;
    getMusicPlansByProduct(productId: string): MusicGenerationRecord[];
    getMusicPlansByGenre(genre: MusicGenre): MusicGenerationRecord[];
    getMusicPlansByMood(mood: MusicMood): MusicGenerationRecord[];
    searchMusicPlans(query: MusicSearchQuery): MusicGenerationRecord[];
    repairMusicPlan(productId: string, platform?: MusicPlatform): Promise<MusicGenerationResult | null>;
    buildStatusReport(): MusicGenerationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=music-generation-engine.d.ts.map