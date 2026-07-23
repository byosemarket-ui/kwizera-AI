import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { ProductUnderstandingRecord } from "../product-understanding-engine/types.js";
import type { BackgroundGenerationRecord } from "../background-generation-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import type { ImageEditingRecord } from "../image-editing-engine/types.js";
import {
  ImageEnhancementInput,
  ImageEnhancementRecord,
  ImageEnhancementRelationships,
} from "./types.js";

export class ImageEnhancementLinker {
  detectRelationships(
    record: ImageEnhancementRecord,
    input: ImageEnhancementInput,
    productImagePlan?: ProductImageGenerationRecord | null,
    backgroundPlan?: BackgroundGenerationRecord | null,
    editingPlan?: ImageEditingRecord | null,
    creative?: CreativeDirectionRecord | null,
    strategy?: MarketingStrategyRecord | null,
    understanding?: ProductUnderstandingRecord | null
  ): ImageEnhancementRelationships {
    const relationships: ImageEnhancementRelationships = {
      sourceImages: [record.profile.sourceImageId],
      enhancedImages: [record.profile.enhancedImageId],
      restoredImages: [record.profile.restoredImageId],
      products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: record.profile.campaignId ? [record.profile.campaignId] : [],
      knowledgeRecords: input.knowledgeRecordIds ?? [],
      imageEditingPlans: input.imageEditingPlanId
        ? [input.imageEditingPlanId]
        : editingPlan
          ? [editingPlan.imageEditingPlanId]
          : [],
      productImagePlans: input.productImagePlanId
        ? [input.productImagePlanId]
        : productImagePlan
          ? [productImagePlan.productImagePlanId]
          : [],
      backgroundPlans: input.backgroundPlanId
        ? [input.backgroundPlanId]
        : backgroundPlan
          ? [backgroundPlan.backgroundPlanId]
          : [],
    };

    if (input.editedImageId && !relationships.enhancedImages.includes(input.editedImageId)) {
      relationships.enhancedImages.push(input.editedImageId);
    }
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
