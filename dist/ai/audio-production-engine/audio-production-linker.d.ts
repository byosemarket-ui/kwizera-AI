import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { AudioProductionInput, AudioProductionRecord, AudioProductionRelationships } from "./types.js";
export declare class AudioProductionLinker {
    detectRelationships(record: AudioProductionRecord, input: AudioProductionInput, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): AudioProductionRelationships;
}
//# sourceMappingURL=audio-production-linker.d.ts.map