import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import { ScriptPlanningRecord, ScriptPlanningRelationships } from "./types.js";
export declare class ScriptPlanningLinker {
    detectRelationships(record: ScriptPlanningRecord, allRecords: ScriptPlanningRecord[], storyboard: StoryboardIntelligenceRecord, creative: CreativeDirectionRecord, strategy: MarketingStrategyRecord, understanding: ProductUnderstandingRecord): ScriptPlanningRelationships;
}
//# sourceMappingURL=script-planning-linker.d.ts.map