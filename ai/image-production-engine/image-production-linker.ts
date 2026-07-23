import type { BrandingDesignRecord } from "../branding-design-engine/types.js";
import type { MultiStyleImageRecord } from "../multi-style-image-generation-engine/types.js";
import type { ProductImageGenerationRecord } from "../product-image-generation-engine/types.js";
import {
  ImageProductionInput,
  ImageProductionRecord,
  ImageProductionRelationships,
} from "./types.js";

export class ImageProductionLinker {
  detectRelationships(
    record: ImageProductionRecord,
    input: ImageProductionInput,
    productImagePlan?: ProductImageGenerationRecord | null,
    brandingPlan?: BrandingDesignRecord | null,
    stylePlan?: MultiStyleImageRecord | null
  ): ImageProductionRelationships {
    const relationships: ImageProductionRelationships = {
      imagePlans: [record.profile.imagePlanId],
      productionPlans: [record.imageProductionId],
      products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: record.profile.campaignId ? [record.profile.campaignId] : [],
      templates: input.templateIds ?? [],
      knowledgeRecords: input.knowledgeRecordIds ?? [],
      stylePlans: input.stylePlanId
        ? [input.stylePlanId]
        : stylePlan
          ? [stylePlan.stylePlanId]
          : [],
      brandingPlans: input.brandingPlanId
        ? [input.brandingPlanId]
        : brandingPlan
          ? [brandingPlan.brandDesignId]
          : [],
      productImagePlans: input.productImagePlanId
        ? [input.productImagePlanId]
        : productImagePlan
          ? [productImagePlan.productImagePlanId]
          : [],
      generatedImages: stylePlan ? [stylePlan.profile.generatedStyleImageId] : [],
      sourceImages: stylePlan
        ? [stylePlan.profile.sourceImageId]
        : productImagePlan
          ? [productImagePlan.productImagePlanId]
          : [],
    };

    if (productImagePlan && !relationships.sourceImages.includes(productImagePlan.productImagePlanId)) {
      relationships.sourceImages.push(productImagePlan.productImagePlanId);
    }

    return relationships;
  }
}
