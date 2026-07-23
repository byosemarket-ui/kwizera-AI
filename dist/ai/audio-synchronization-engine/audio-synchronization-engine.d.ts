import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { AudioSynchronizationLogger } from "./audio-synchronization-logger.js";
import { AudioSynchronizationRecordStore } from "./audio-synchronization-stores.js";
import { AudioSynchronizationEngineStatusReport, AudioSynchronizationInput, AudioSynchronizationRecord, AudioSynchronizationResult, AudioSynchronizationSearchQuery } from "./types.js";
import { StoryboardGenerationPlatform } from "../story-generation-engine/types.js";
/**
 * AI Audio Synchronization Engine — production-ready audio sync for voice, music,
 * sound effects, subtitles, lip sync, and scene timing.
 */
export declare class AiAudioSynchronizationEngine {
    private foundation;
    private engineDir;
    private initialized;
    private startupComplete;
    readonly logger: AudioSynchronizationLogger;
    readonly records: AudioSynchronizationRecordStore;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private processor;
    private syncTimes;
    private searchTimes;
    private lipSyncTimes;
    initialize(foundation: AiVideoGenerationFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    generateAudioSyncPlans(input: AudioSynchronizationInput): Promise<AudioSynchronizationResult>;
    getAudioSyncPlan(audioSynchronizationId: string): AudioSynchronizationRecord | null;
    getAudioSyncPlansByScene(sceneId: string): AudioSynchronizationRecord[];
    getAudioSyncPlansByStoryboard(storyboardId: string): AudioSynchronizationRecord[];
    searchAudioSyncPlans(query: AudioSynchronizationSearchQuery): AudioSynchronizationRecord[];
    repairAudioSyncPlans(storyboardId: string, platform?: StoryboardGenerationPlatform): Promise<AudioSynchronizationResult | null>;
    buildStatusReport(): AudioSynchronizationEngineStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=audio-synchronization-engine.d.ts.map