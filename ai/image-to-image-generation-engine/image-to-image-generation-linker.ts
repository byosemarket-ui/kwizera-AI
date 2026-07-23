import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { TextToImageGenerationRecord } from "../text-to-image-generation-engine/types.js";
import {
  ImageToImageGenerationInput,
  ImageToImageGenerationRecord,
  ImageToImageRelationships,
} from "./types.js";

export class ImageToImageGenerationLinker {
  detectRelationships(
    record: ImageToImageGenerationRecord,
    input: ImageToImageGenerationInput,
    textToImagePlan?: TextToImageGenerationRecord | null,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): ImageToImageRelationships {
    const relationships: ImageToImageRelationships = {
      sourceImages: [record.profile.sourceImageId],
      generatedImages: [record.profile.generatedImageId],
      products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: input.campaignId ? [input.campaignId] : [],
      prompts: [record.profile.promptId],
      knowledgeRecords: input.knowledgeRecordIds ?? [],
      textToImagePlans: input.textToImagePlanId ? [input.textToImagePlanId] : textToImagePlan ? [textToImagePlan.imagePlanId] : [],
    };

    if (understanding?.productId && !relationships.products.includes(understanding.productId)) {
      relationships.products.push(understanding.productId);
    }
    if (creative?.profile.brand && !relationships.brands.includes(creative.profile.brand)) {
      relationships.brands.push(creative.profile.brand);
    }
    if (strategy?.relationships.campaigns.length) {
      relationships.campaigns.push(...strategy.relationships.campaigns.filter((c) => !relationships.campaigns.includes(c)));
    }

    return relationships;
  }
}
