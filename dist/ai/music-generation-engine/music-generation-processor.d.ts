import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { MusicGenerationAnalyzer } from "./music-generation-analyzer.js";
import { MusicGenerationLinker } from "./music-generation-linker.js";
import { MusicGenerationLogger } from "./music-generation-logger.js";
import { MusicGenerationScorer } from "./music-generation-scorer.js";
import { MusicGenerationRecordStore } from "./music-generation-stores.js";
import { MusicGenerationInput, MusicGenerationRecord, MusicGenerationResult, MusicSearchQuery } from "./types.js";
export declare class MusicGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiAudioGenerationFoundation, analyzer: MusicGenerationAnalyzer, scorer: MusicGenerationScorer, linker: MusicGenerationLinker, records: MusicGenerationRecordStore, logger: MusicGenerationLogger);
    generateMusicPlan(input: MusicGenerationInput): Promise<MusicGenerationResult>;
    search(query: MusicSearchQuery): MusicGenerationRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=music-generation-processor.d.ts.map