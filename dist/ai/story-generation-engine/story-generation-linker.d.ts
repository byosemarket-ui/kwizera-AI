import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import { StoryboardGenerationInput, StoryboardGenerationRecord, StoryboardGenerationRelationships } from "./types.js";
export declare class StoryGenerationLinker {
    detectRelationships(record: StoryboardGenerationRecord, input: StoryboardGenerationInput, intelligence?: StoryboardIntelligenceRecord | null, creative?: CreativeDirectionRecord | null, strategy?: MarketingStrategyRecord | null, understanding?: ProductUnderstandingRecord | null): StoryboardGenerationRelationships;
}
//# sourceMappingURL=story-generation-linker.d.ts.map