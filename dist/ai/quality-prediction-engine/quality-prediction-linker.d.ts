import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import type { AudioPlanningRecord } from "../audio-planning-engine/types.js";
import type { ProductionPlanningRecord } from "../production-planning-engine/types.js";
import { QualityPredictionRecord, QualityPredictionRelationships } from "./types.js";
export declare class QualityPredictionLinker {
    detectRelationships(record: QualityPredictionRecord, storyboard: StoryboardIntelligenceRecord, scriptPlan: ScriptPlanningRecord, visualPlan: VisualPlanningRecord, audioPlan: AudioPlanningRecord, productionPlan: ProductionPlanningRecord, creative: CreativeDirectionRecord, strategy: MarketingStrategyRecord, understanding: ProductUnderstandingRecord): QualityPredictionRelationships;
}
//# sourceMappingURL=quality-prediction-linker.d.ts.map