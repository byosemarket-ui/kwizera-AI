import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import { StoryboardIntelligenceRecord, StoryboardRelationships } from "./types.js";

export class StoryboardLinker {
  detectRelationships(
    record: StoryboardIntelligenceRecord,
    allRecords: StoryboardIntelligenceRecord[],
    creative: CreativeDirectionRecord,
    strategy: MarketingStrategyRecord,
    understanding: ProductUnderstandingRecord
  ): StoryboardRelationships {
    const creativeDirections = [record.creativeId, ...creative.relationships.creativeStyles.map(String)];
    const products = [record.productId];
    const brands = [creative.profile.brand];
    const marketingStrategies = [record.strategyId];
    const scripts: string[] = [];
    const visualPlans: string[] = [];
    const audioPlans: string[] = [];
    const productionPlans: string[] = [];

    if (record.productionReady) {
      scripts.push(`script-prep-${record.storyboardId}`);
      visualPlans.push(`visual-prep-${record.storyboardId}`);
      audioPlans.push(`audio-prep-${record.storyboardId}`);
      productionPlans.push(`production-prep-${record.storyboardId}`);
    }

    scripts.push(...creative.relationships.scripts);
    visualPlans.push(...creative.relationships.visualPlans);
    audioPlans.push(...creative.relationships.audioPlans);

    const knowledgeRecords = [
      ...new Set([
        ...record.relationships.knowledgeRecords,
        ...understanding.relationships.knowledgeRecords,
        ...strategy.relationships.knowledgeRecords,
        ...creative.relationships.knowledgeRecords,
      ]),
    ];

    for (const other of allRecords) {
      if (other.storyboardId === record.storyboardId) continue;
      if (other.profile.platform === record.profile.platform) {
        productionPlans.push(`related-${other.storyboardId}`);
      }
    }

    return {
      creativeDirections: [...new Set(creativeDirections)],
      products: [...new Set(products)],
      brands: [...new Set(brands)],
      marketingStrategies: [...new Set(marketingStrategies)],
      scripts: [...new Set(scripts)],
      visualPlans: [...new Set(visualPlans)],
      audioPlans: [...new Set(audioPlans)],
      productionPlans: [...new Set(productionPlans)].slice(0, 10),
      knowledgeRecords,
    };
  }
}
