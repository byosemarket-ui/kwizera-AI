import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { StoryboardIntelligenceRecord, StoryboardRelationships } from "./types.js";
export declare class StoryboardLinker {
    detectRelationships(record: StoryboardIntelligenceRecord, allRecords: StoryboardIntelligenceRecord[], creative: CreativeDirectionRecord, strategy: MarketingStrategyRecord, understanding: ProductUnderstandingRecord): StoryboardRelationships;
}
//# sourceMappingURL=storyboard-linker.d.ts.map