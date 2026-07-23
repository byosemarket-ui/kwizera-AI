import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { BackgroundGenerationRecord } from "../background-generation-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import {
  ImageEditingInput,
  ImageEditingRecord,
  ImageEditingRelationships,
} from "./types.js";

export class ImageEditingLinker {
  detectRelationships(
    record: ImageEditingRecord,
    input: ImageEditingInput,
    productImagePlan?: ProductImageGenerationRecord | null,
    backgroundPlan?: BackgroundGenerationRecord | null,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): ImageEditingRelationships {
    const relationships: ImageEditingRelationships = {
      sourceImages: [record.profile.sourceImageId],
      editedImages: [record.profile.editedImageId],
      products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: record.profile.campaignId ? [record.profile.campaignId] : [],
      prompts: [record.profile.promptId],
      masks: input.maskIds ?? record.maskManagement.masks.map((m) => m.maskId),
      knowledgeRecords: input.knowledgeRecordIds ?? [],
      backgroundPlans: input.backgroundPlanId ? [input.backgroundPlanId] : backgroundPlan ? [backgroundPlan.backgroundPlanId] : [],
      productImagePlans: input.productImagePlanId
        ? [input.productImagePlanId]
        : productImagePlan
          ? [productImagePlan.productImagePlanId]
          : [],
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
