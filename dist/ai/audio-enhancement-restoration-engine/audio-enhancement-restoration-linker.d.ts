import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { AudioEnhancementGenerationInput, AudioEnhancementGenerationRecord, AudioEnhancementRelationships } from "./types.js";
export declare class AudioEnhancementRestorationLinker {
    detectRelationships(record: AudioEnhancementGenerationRecord, input: AudioEnhancementGenerationInput, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): AudioEnhancementRelationships;
}
//# sourceMappingURL=audio-enhancement-restoration-linker.d.ts.map