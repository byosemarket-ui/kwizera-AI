import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import { VisualPlanningRecord, VisualPlanningRelationships } from "./types.js";

export class VisualPlanningLinker {
  detectRelationships(
    record: VisualPlanningRecord,
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    creative: CreativeDirectionRecord,
    strategy: MarketingStrategyRecord,
    understanding: ProductUnderstandingRecord
  ): VisualPlanningRelationships {
    const audioPlans: string[] = [];
    const productionPlans: string[] = [];

    if (record.productionReady) {
      audioPlans.push(`audio-prep-${record.scriptPlanId}`);
      productionPlans.push(`production-prep-${record.visualPlanId}`);
    }

    audioPlans.push(...scriptPlan.relationships.audioPlans);
    productionPlans.push(...scriptPlan.relationships.productionPlans);
    productionPlans.push(...storyboard.relationships.productionPlans);

    const knowledgeRecords = [
      ...new Set([
        ...understanding.relationships.knowledgeRecords,
        ...strategy.relationships.knowledgeRecords,
        ...creative.relationships.knowledgeRecords,
        ...storyboard.relationships.knowledgeRecords,
        ...scriptPlan.relationships.knowledgeRecords,
      ]),
    ];

    return {
      storyboards: [record.storyboardId],
      scriptPlans: [record.scriptPlanId],
      creativeDirections: [record.creativeId, ...storyboard.relationships.creativeDirections],
      marketingStrategies: [record.strategyId, ...storyboard.relationships.marketingStrategies],
      products: [record.productId],
      brands: [creative.profile.brand],
      audioPlans: [...new Set(audioPlans)].slice(0, 10),
      productionPlans: [...new Set(productionPlans)].slice(0, 10),
      knowledgeRecords,
    };
  }
}
