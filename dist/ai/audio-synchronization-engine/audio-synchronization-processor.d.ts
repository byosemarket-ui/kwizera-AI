import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";
import { AudioSynchronizationAnalyzer } from "./audio-synchronization-analyzer.js";
import { AudioSynchronizationLinker } from "./audio-synchronization-linker.js";
import { AudioSynchronizationLogger } from "./audio-synchronization-logger.js";
import { AudioSynchronizationScorer } from "./audio-synchronization-scorer.js";
import { AudioSynchronizationRecordStore } from "./audio-synchronization-stores.js";
import { AudioSynchronizationInput, AudioSynchronizationRecord, AudioSynchronizationResult, AudioSynchronizationSearchQuery } from "./types.js";
export declare class AudioSynchronizationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiVideoGenerationFoundation, analyzer: AudioSynchronizationAnalyzer, scorer: AudioSynchronizationScorer, linker: AudioSynchronizationLinker, records: AudioSynchronizationRecordStore, logger: AudioSynchronizationLogger);
    generateAudioSyncPlans(input: AudioSynchronizationInput): Promise<AudioSynchronizationResult>;
    search(query: AudioSynchronizationSearchQuery): AudioSynchronizationRecord[];
    private resolveBundles;
    private registerGenerationAsset;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=audio-synchronization-processor.d.ts.map