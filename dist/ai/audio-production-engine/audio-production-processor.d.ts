import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { AudioProductionAnalyzer } from "./audio-production-analyzer.js";
import { AudioProductionLinker } from "./audio-production-linker.js";
import { AudioProductionLogger } from "./audio-production-logger.js";
import { AudioProductionScorer } from "./audio-production-scorer.js";
import { AudioProductionRecordStore } from "./audio-production-stores.js";
import { AudioProductionInput, AudioProductionRecord, AudioProductionResult, AudioProductionSearchQuery } from "./types.js";
export declare class AudioProductionProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiAudioGenerationFoundation, analyzer: AudioProductionAnalyzer, scorer: AudioProductionScorer, linker: AudioProductionLinker, records: AudioProductionRecordStore, logger: AudioProductionLogger);
    generateProductionPlan(input: AudioProductionInput): Promise<AudioProductionResult>;
    search(query: AudioProductionSearchQuery): AudioProductionRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=audio-production-processor.d.ts.map