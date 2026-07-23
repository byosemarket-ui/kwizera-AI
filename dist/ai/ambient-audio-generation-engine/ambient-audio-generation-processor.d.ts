import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { AmbientAudioGenerationAnalyzer } from "./ambient-audio-generation-analyzer.js";
import { AmbientAudioGenerationLinker } from "./ambient-audio-generation-linker.js";
import { AmbientAudioGenerationLogger } from "./ambient-audio-generation-logger.js";
import { AmbientAudioGenerationScorer } from "./ambient-audio-generation-scorer.js";
import { AmbientAudioGenerationRecordStore } from "./ambient-audio-generation-stores.js";
import { AmbientAudioGenerationInput, AmbientAudioGenerationRecord, AmbientAudioGenerationResult, AmbientAudioSearchQuery } from "./types.js";
export declare class AmbientAudioGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiAudioGenerationFoundation, analyzer: AmbientAudioGenerationAnalyzer, scorer: AmbientAudioGenerationScorer, linker: AmbientAudioGenerationLinker, records: AmbientAudioGenerationRecordStore, logger: AmbientAudioGenerationLogger);
    generateAmbientPlan(input: AmbientAudioGenerationInput): Promise<AmbientAudioGenerationResult>;
    search(query: AmbientAudioSearchQuery): AmbientAudioGenerationRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=ambient-audio-generation-processor.d.ts.map