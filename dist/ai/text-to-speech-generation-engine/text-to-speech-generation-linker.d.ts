import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { TextToSpeechGenerationInput, TextToSpeechGenerationRecord, TextToSpeechRelationships } from "./types.js";
export declare class TextToSpeechGenerationLinker {
    detectRelationships(record: TextToSpeechGenerationRecord, input: TextToSpeechGenerationInput, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): TextToSpeechRelationships;
}
//# sourceMappingURL=text-to-speech-generation-linker.d.ts.map