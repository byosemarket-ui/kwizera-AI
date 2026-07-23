import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { MusicGenerationInput, MusicGenerationRecord, MusicGenerationRelationships } from "./types.js";
export declare class MusicGenerationLinker {
    detectRelationships(record: MusicGenerationRecord, input: MusicGenerationInput, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): MusicGenerationRelationships;
}
//# sourceMappingURL=music-generation-linker.d.ts.map