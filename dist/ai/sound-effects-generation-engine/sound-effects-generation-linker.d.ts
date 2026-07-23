import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { SoundEffectsGenerationInput, SoundEffectsGenerationRecord, SoundEffectsRelationships } from "./types.js";
export declare class SoundEffectsGenerationLinker {
    detectRelationships(record: SoundEffectsGenerationRecord, input: SoundEffectsGenerationInput, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): SoundEffectsRelationships;
}
//# sourceMappingURL=sound-effects-generation-linker.d.ts.map