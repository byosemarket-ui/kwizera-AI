import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { AudioMixingMasteringAnalyzer } from "./audio-mixing-mastering-analyzer.js";
import { AudioMixingMasteringLinker } from "./audio-mixing-mastering-linker.js";
import { AudioMixingMasteringLogger } from "./audio-mixing-mastering-logger.js";
import { AudioMixingMasteringScorer } from "./audio-mixing-mastering-scorer.js";
import { AudioMixingMasteringRecordStore } from "./audio-mixing-mastering-stores.js";
import { AudioMixMasterGenerationInput, AudioMixMasterGenerationRecord, AudioMixMasterGenerationResult, AudioMixMasterSearchQuery } from "./types.js";
export declare class AudioMixingMasteringProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiAudioGenerationFoundation, analyzer: AudioMixingMasteringAnalyzer, scorer: AudioMixingMasteringScorer, linker: AudioMixingMasteringLinker, records: AudioMixingMasteringRecordStore, logger: AudioMixingMasteringLogger);
    generateMixMasterPlan(input: AudioMixMasterGenerationInput): Promise<AudioMixMasterGenerationResult>;
    search(query: AudioMixMasterSearchQuery): AudioMixMasterGenerationRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=audio-mixing-mastering-processor.d.ts.map