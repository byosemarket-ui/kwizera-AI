import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import {
  ProductImageGenerationInput,
  ProductImageGenerationRecord,
  ProductImageGenerationRelationships,
} from "./types.js";

export class ProductImageGenerationLinker {
  detectRelationships(
    record: ProductImageGenerationRecord,
    input: ProductImageGenerationInput,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): ProductImageGenerationRelationships {
    const relationships: ProductImageGenerationRelationships = {
      products: [record.profile.productId],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: record.profile.campaignId ? [record.profile.campaignId] : [],
      sourceImages: input.sourceImageIds ?? [],
      generatedImages: [`gen-${record.productImagePlanId}`],
      templates: input.styleReferenceIds ?? [],
      knowledgeRecords: input.knowledgeRecordIds ?? [],
      textToImagePlans: input.textToImagePlanId ? [input.textToImagePlanId] : [],
      imageToImagePlans: [],
    };

    if (understanding?.productId && !relationships.products.includes(understanding.productId)) {
      relationships.products.push(understanding.productId);
    }
    if (creative?.profile.brand && !relationships.brands.includes(creative.profile.brand)) {
      relationships.brands.push(creative.profile.brand);
    }
    if (strategy?.relationships.campaigns.length) {
      relationships.campaigns.push(
        ...strategy.relationships.campaigns.filter((c) => !relationships.campaigns.includes(c))
      );
    }

    return relationships;
  }
}
