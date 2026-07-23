import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { SpeechToSpeechGenerationAnalyzer } from "./speech-to-speech-generation-analyzer.js";
import { SpeechToSpeechGenerationLinker } from "./speech-to-speech-generation-linker.js";
import { SpeechToSpeechGenerationLogger } from "./speech-to-speech-generation-logger.js";
import { SpeechToSpeechGenerationScorer } from "./speech-to-speech-generation-scorer.js";
import { SpeechToSpeechGenerationRecordStore } from "./speech-to-speech-generation-stores.js";
import { SpeechToSpeechGenerationInput, SpeechToSpeechGenerationRecord, SpeechToSpeechGenerationResult, SpeechToSpeechSearchQuery } from "./types.js";
export declare class SpeechToSpeechGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiAudioGenerationFoundation, analyzer: SpeechToSpeechGenerationAnalyzer, scorer: SpeechToSpeechGenerationScorer, linker: SpeechToSpeechGenerationLinker, records: SpeechToSpeechGenerationRecordStore, logger: SpeechToSpeechGenerationLogger);
    generateTransformationPlan(input: SpeechToSpeechGenerationInput): Promise<SpeechToSpeechGenerationResult>;
    search(query: SpeechToSpeechSearchQuery): SpeechToSpeechGenerationRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=speech-to-speech-generation-processor.d.ts.map