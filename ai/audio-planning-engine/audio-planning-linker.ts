import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import { AudioPlanningRecord, AudioPlanningRelationships } from "./types.js";

export class AudioPlanningLinker {
  detectRelationships(
    record: AudioPlanningRecord,
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    creative: CreativeDirectionRecord,
    strategy: MarketingStrategyRecord,
    understanding: ProductUnderstandingRecord
  ): AudioPlanningRelationships {
    const productionPlans: string[] = [];

    if (record.productionReady) {
      productionPlans.push(`production-prep-${record.audioPlanId}`);
    }

    productionPlans.push(...visualPlan.relationships.productionPlans);
    productionPlans.push(...scriptPlan.relationships.productionPlans);
    productionPlans.push(...storyboard.relationships.productionPlans);

    const knowledgeRecords = [
      ...new Set([
        ...understanding.relationships.knowledgeRecords,
        ...strategy.relationships.knowledgeRecords,
        ...creative.relationships.knowledgeRecords,
        ...storyboard.relationships.knowledgeRecords,
        ...scriptPlan.relationships.knowledgeRecords,
        ...visualPlan.relationships.knowledgeRecords,
      ]),
    ];

    return {
      storyboards: [record.storyboardId],
      scriptPlans: [record.scriptPlanId],
      visualPlans: [record.visualPlanId],
      creativeDirections: [record.creativeId, ...storyboard.relationships.creativeDirections],
      marketingStrategies: [record.strategyId, ...storyboard.relationships.marketingStrategies],
      brands: [creative.profile.brand],
      languages: [record.profile.language],
      productionPlans: [...new Set(productionPlans)].slice(0, 10),
      knowledgeRecords,
    };
  }
}
