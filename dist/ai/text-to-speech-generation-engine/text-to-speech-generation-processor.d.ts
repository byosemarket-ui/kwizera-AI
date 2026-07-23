import type { AiAudioGenerationFoundation } from "../audio-generation-foundation/audio-generation-foundation.js";
import { TextToSpeechGenerationAnalyzer } from "./text-to-speech-generation-analyzer.js";
import { TextToSpeechGenerationLinker } from "./text-to-speech-generation-linker.js";
import { TextToSpeechGenerationLogger } from "./text-to-speech-generation-logger.js";
import { TextToSpeechGenerationScorer } from "./text-to-speech-generation-scorer.js";
import { TextToSpeechGenerationRecordStore } from "./text-to-speech-generation-stores.js";
import { TextToSpeechGenerationInput, TextToSpeechGenerationRecord, TextToSpeechGenerationResult, TextToSpeechSearchQuery } from "./types.js";
export declare class TextToSpeechGenerationProcessor {
    private readonly foundation;
    private readonly analyzer;
    private readonly scorer;
    private readonly linker;
    private readonly records;
    private readonly logger;
    constructor(foundation: AiAudioGenerationFoundation, analyzer: TextToSpeechGenerationAnalyzer, scorer: TextToSpeechGenerationScorer, linker: TextToSpeechGenerationLinker, records: TextToSpeechGenerationRecordStore, logger: TextToSpeechGenerationLogger);
    generateSpeechPlan(input: TextToSpeechGenerationInput): Promise<TextToSpeechGenerationResult>;
    search(query: TextToSpeechSearchQuery): TextToSpeechGenerationRecord[];
    private resolveContext;
    private registerGenerationAssets;
    private applySafeRepairs;
    private reject;
}
//# sourceMappingURL=text-to-speech-generation-processor.d.ts.map