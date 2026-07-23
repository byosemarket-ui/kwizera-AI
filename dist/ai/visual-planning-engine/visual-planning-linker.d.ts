import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import { VisualPlanningRecord, VisualPlanningRelationships } from "./types.js";
export declare class VisualPlanningLinker {
    detectRelationships(record: VisualPlanningRecord, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, creative: CreativeDirectionRecord, strategy: MarketingStrategyRecord, understanding: ProductUnderstandingRecord): VisualPlanningRelationships;
}
//# sourceMappingURL=visual-planning-linker.d.ts.map