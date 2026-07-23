import type { ImageProductionRecord } from "../image-production-engine/types.js";
import type { MultiStyleImageRecord } from "../multi-style-image-generation-engine/types.js";
import { ImageRenderInput, ImageRenderRecord, ImageRenderRelationships } from "./types.js";

export class ImageRenderLinker {
  detectRelationships(
    record: ImageRenderRecord,
    input: ImageRenderInput,
    productionPlan?: ImageProductionRecord | null,
    stylePlan?: MultiStyleImageRecord | null,
    productId?: string
  ): ImageRenderRelationships {
    return {
      imagePlans: productionPlan ? [productionPlan.profile.imagePlanId] : stylePlan ? [stylePlan.stylePlanId] : [],
      productionPlans: input.productionId
        ? [input.productionId]
        : productionPlan
          ? [productionPlan.imageProductionId]
          : [],
      renderPlans: [record.imageRenderPlanId],
      products: productId ? [productId] : productionPlan ? [productionPlan.profile.productId] : [],
      brands: productionPlan?.profile.brandId ? [productionPlan.profile.brandId] : input.brandId ? [input.brandId] : [],
      campaigns: productionPlan?.profile.campaignId ? [productionPlan.profile.campaignId] : [],
      templates: input.templateIds ?? productionPlan?.relationships.templates ?? [],
      knowledgeRecords: input.knowledgeRecordIds ?? [],
      stylePlans: input.stylePlanId
        ? [input.stylePlanId]
        : stylePlan
          ? [stylePlan.stylePlanId]
          : productionPlan?.relationships.stylePlans ?? [],
    };
  }
}
