import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { VoiceCloningGenerationInput, VoiceCloningGenerationRecord, VoiceCloningRelationships } from "./types.js";
export declare class VoiceCloningGenerationLinker {
    detectRelationships(record: VoiceCloningGenerationRecord, input: VoiceCloningGenerationInput, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): VoiceCloningRelationships;
}
//# sourceMappingURL=voice-cloning-generation-linker.d.ts.map