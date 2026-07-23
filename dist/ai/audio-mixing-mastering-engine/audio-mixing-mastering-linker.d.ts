import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { AudioMixMasterGenerationInput, AudioMixMasterGenerationRecord, AudioMixMasterRelationships } from "./types.js";
export declare class AudioMixingMasteringLinker {
    detectRelationships(record: AudioMixMasterGenerationRecord, input: AudioMixMasterGenerationInput, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): AudioMixMasterRelationships;
}
//# sourceMappingURL=audio-mixing-mastering-linker.d.ts.map