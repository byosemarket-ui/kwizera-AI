import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { AudioRenderAnalyzer } from "./audio-render-analyzer.js";
import { AudioRenderLinker } from "./audio-render-linker.js";
import { AudioRenderLogger } from "./audio-render-logger.js";
import { AudioRenderScorer } from "./audio-render-scorer.js";
import { AudioRenderRecordStore } from "./audio-render-stores.js";
import { AudioRenderInput, AudioRenderRecord, AudioRenderResult, AudioRenderSearchQuery } from "./types.js";
export declare class AudioRenderProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiAudioGenerationFoundation, analyzer: AudioRenderAnalyzer, scorer: AudioRenderScorer, linker: AudioRenderLinker, records: AudioRenderRecordStore, logger: AudioRenderLogger);
    generateRenderPlan(input: AudioRenderInput): Promise<AudioRenderResult>;
    search(query: AudioRenderSearchQuery): AudioRenderRecord[];
    private resolveContext;
    private registerRenderAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=audio-render-processor.d.ts.map