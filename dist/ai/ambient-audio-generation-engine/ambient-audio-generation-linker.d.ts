import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { AmbientAudioGenerationInput, AmbientAudioGenerationRecord, AmbientAudioRelationships } from "./types.js";
export declare class AmbientAudioGenerationLinker {
    detectRelationships(record: AmbientAudioGenerationRecord, input: AmbientAudioGenerationInput, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): AmbientAudioRelationships;
}
//# sourceMappingURL=ambient-audio-generation-linker.d.ts.map