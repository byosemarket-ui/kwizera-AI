import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { AudioEnhancementRestorationAnalyzer } from "./audio-enhancement-restoration-analyzer.js";
import { AudioEnhancementRestorationLinker } from "./audio-enhancement-restoration-linker.js";
import { AudioEnhancementRestorationLogger } from "./audio-enhancement-restoration-logger.js";
import { AudioEnhancementRestorationScorer } from "./audio-enhancement-restoration-scorer.js";
import { AudioEnhancementRestorationRecordStore } from "./audio-enhancement-restoration-stores.js";
import { AudioEnhancementGenerationInput, AudioEnhancementGenerationRecord, AudioEnhancementGenerationResult, AudioEnhancementSearchQuery } from "./types.js";
export declare class AudioEnhancementRestorationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiAudioGenerationFoundation, analyzer: AudioEnhancementRestorationAnalyzer, scorer: AudioEnhancementRestorationScorer, linker: AudioEnhancementRestorationLinker, records: AudioEnhancementRestorationRecordStore, logger: AudioEnhancementRestorationLogger);
    generateEnhancementPlan(input: AudioEnhancementGenerationInput): Promise<AudioEnhancementGenerationResult>;
    search(query: AudioEnhancementSearchQuery): AudioEnhancementGenerationRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=audio-enhancement-restoration-processor.d.ts.map