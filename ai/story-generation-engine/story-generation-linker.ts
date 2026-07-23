import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import { StoryboardGenerationInput, StoryboardGenerationRecord, StoryboardGenerationRelationships } from "./types.js";

export class StoryGenerationLinker {
  detectRelationships(
    record: StoryboardGenerationRecord,
    input: StoryboardGenerationInput,
    intelligence?: StoryboardIntelligenceRecord | null,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): StoryboardGenerationRelationships {
    const relationships: StoryboardGenerationRelationships = {
      products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: record.profile.campaignId ? [record.profile.campaignId] : [],
      scripts: input.scriptId ? [input.scriptId] : intelligence?.relationships.scripts ?? [],
      images: input.imageIds ?? [],
      videos: input.videoIds ?? [],
      audio: input.voiceInstructions ? [`voice-${record.storyboardId}`] : [],
      knowledgeRecords: input.knowledgeRecordIds ?? intelligence?.relationships.knowledgeRecords ?? [],
      productionPlans: intelligence?.relationships.productionPlans ?? [],
      storyboardIntelligenceIds: intelligence ? [intelligence.storyboardId] : [],
      creativeDirections: creative ? [creative.creativeId] : intelligence?.relationships.creativeDirections ?? [],
      marketingStrategies: strategy ? [strategy.strategyId] : intelligence?.relationships.marketingStrategies ?? [],
    };

    if (understanding?.productId && !relationships.products.includes(understanding.productId)) {
      relationships.products.push(understanding.productId);
    }
    if (creative?.profile.brand && !relationships.brands.includes(creative.profile.brand)) {
      relationships.brands.push(creative.profile.brand);
    }

    return relationships;
  }
}
