import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { SpeechToSpeechGenerationInput, SpeechToSpeechGenerationRecord, SpeechToSpeechRelationships } from "./types.js";
export declare class SpeechToSpeechGenerationLinker {
    detectRelationships(record: SpeechToSpeechGenerationRecord, input: SpeechToSpeechGenerationInput, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): SpeechToSpeechRelationships;
}
//# sourceMappingURL=speech-to-speech-generation-linker.d.ts.map