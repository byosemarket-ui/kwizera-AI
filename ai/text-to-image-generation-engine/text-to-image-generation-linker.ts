import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  TextToImageGenerationInput,
  TextToImageGenerationRecord,
  TextToImageRelationships,
} from "./types.js";

export class TextToImageGenerationLinker {
  detectRelationships(
    record: TextToImageGenerationRecord,
    input: TextToImageGenerationInput,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): TextToImageRelationships {
    const relationships: TextToImageRelationships = {
      prompts: [record.profile.promptId],
      products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: input.campaignId ? [input.campaignId] : [],
      images: [record.imagePlanId],
      knowledgeRecords: input.knowledgeRecordIds ?? [],
      productionPlans: [],
      creativeDirections: creative ? [creative.creativeId] : [],
      marketingStrategies: strategy ? [strategy.strategyId] : [],
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
