import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import type { AudioPlanningRecord } from "../audio-planning-engine/types.js";
import { ProductionPlanningRecord, ProductionPlanningRelationships } from "./types.js";

export class ProductionPlanningLinker {
  detectRelationships(
    record: ProductionPlanningRecord,
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord,
    creative: CreativeDirectionRecord,
    strategy: MarketingStrategyRecord,
    understanding: ProductUnderstandingRecord
  ): ProductionPlanningRelationships {
    const knowledgeRecords = [
      ...new Set([
        ...record.relationships.knowledgeRecords,
        ...understanding.relationships.knowledgeRecords,
        ...strategy.relationships.knowledgeRecords,
        ...creative.relationships.knowledgeRecords,
        ...storyboard.relationships.knowledgeRecords,
        ...scriptPlan.relationships.knowledgeRecords,
        ...visualPlan.relationships.knowledgeRecords,
        ...audioPlan.relationships.knowledgeRecords,
      ]),
    ];

    const productionHistory = [
      `production-v${record.version}-${record.productionPlanId}`,
      ...audioPlan.relationships.productionPlans.filter((p) => p.startsWith("production-prep")),
    ];

    return {
      storyboards: [record.storyboardId],
      scriptPlans: [record.scriptPlanId],
      visualPlans: [record.visualPlanId],
      audioPlans: [record.audioPlanId],
      creativeDirections: [record.creativeId, ...storyboard.relationships.creativeDirections],
      marketingStrategies: [record.strategyId, ...storyboard.relationships.marketingStrategies],
      products: [record.productId],
      brands: [creative.profile.brand],
      knowledgeRecords,
      productionHistory: [...new Set(productionHistory)].slice(0, 10),
    };
  }
}
