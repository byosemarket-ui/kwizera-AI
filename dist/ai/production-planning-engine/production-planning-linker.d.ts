import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import type { AudioPlanningRecord } from "../audio-planning-engine/types.js";
import { ProductionPlanningRecord, ProductionPlanningRelationships } from "./types.js";
export declare class ProductionPlanningLinker {
    detectRelationships(record: ProductionPlanningRecord, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord, creative: CreativeDirectionRecord, strategy: MarketingStrategyRecord, understanding: ProductUnderstandingRecord): ProductionPlanningRelationships;
}
//# sourceMappingURL=production-planning-linker.d.ts.map