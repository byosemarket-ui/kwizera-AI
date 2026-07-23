import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { VoiceCloningGenerationAnalyzer } from "./voice-cloning-generation-analyzer.js";
import { VoiceCloningGenerationLinker } from "./voice-cloning-generation-linker.js";
import { VoiceCloningGenerationLogger } from "./voice-cloning-generation-logger.js";
import { VoiceCloningGenerationScorer } from "./voice-cloning-generation-scorer.js";
import { VoiceCloningGenerationRecordStore } from "./voice-cloning-generation-stores.js";
import { VoiceCloningGenerationInput, VoiceCloningGenerationRecord, VoiceCloningGenerationResult, VoiceCloningSearchQuery } from "./types.js";
export declare class VoiceCloningGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiAudioGenerationFoundation, analyzer: VoiceCloningGenerationAnalyzer, scorer: VoiceCloningGenerationScorer, linker: VoiceCloningGenerationLinker, records: VoiceCloningGenerationRecordStore, logger: VoiceCloningGenerationLogger);
    generateCloningPlan(input: VoiceCloningGenerationInput): Promise<VoiceCloningGenerationResult>;
    search(query: VoiceCloningSearchQuery): VoiceCloningGenerationRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=voice-cloning-generation-processor.d.ts.map