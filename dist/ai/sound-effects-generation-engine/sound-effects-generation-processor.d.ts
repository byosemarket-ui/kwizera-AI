import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { SoundEffectsGenerationAnalyzer } from "./sound-effects-generation-analyzer.js";
import { SoundEffectsGenerationLinker } from "./sound-effects-generation-linker.js";
import { SoundEffectsGenerationLogger } from "./sound-effects-generation-logger.js";
import { SoundEffectsGenerationScorer } from "./sound-effects-generation-scorer.js";
import { SoundEffectsGenerationRecordStore } from "./sound-effects-generation-stores.js";
import { SoundEffectsGenerationInput, SoundEffectsGenerationRecord, SoundEffectsGenerationResult, SoundEffectsSearchQuery } from "./types.js";
export declare class SoundEffectsGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiAudioGenerationFoundation, analyzer: SoundEffectsGenerationAnalyzer, scorer: SoundEffectsGenerationScorer, linker: SoundEffectsGenerationLinker, records: SoundEffectsGenerationRecordStore, logger: SoundEffectsGenerationLogger);
    generateSoundEffectPlan(input: SoundEffectsGenerationInput): Promise<SoundEffectsGenerationResult>;
    search(query: SoundEffectsSearchQuery): SoundEffectsGenerationRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=sound-effects-generation-processor.d.ts.map