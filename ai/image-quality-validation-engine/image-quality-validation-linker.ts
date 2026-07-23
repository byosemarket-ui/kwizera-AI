import type { ImageProductionRecord } from "../image-production-engine/types.js";
import type { ImageRenderRecord } from "../image-rendering-preparation-engine/types.js";
import {
  ImageQualityValidationInput,
  ImageQualityValidationRecord,
  QualityValidationRelationships,
} from "./types.js";

export class ImageQualityValidationLinker {
  detectRelationships(
    record: ImageQualityValidationRecord,
    input: ImageQualityValidationInput,
    productionPlan?: ImageProductionRecord | null,
    renderPlan?: ImageRenderRecord | null
  ): QualityValidationRelationships {
    return {
      imagePlans: record.profile.imagePlanId ? [record.profile.imagePlanId] : [],
      productionPlans: input.productionId
        ? [input.productionId]
        : productionPlan
          ? [productionPlan.imageProductionId]
          : [],
      renderPlans: input.renderPlanId
        ? [input.renderPlanId]
        : renderPlan
          ? [renderPlan.imageRenderPlanId]
          : [],
      products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: productionPlan?.profile.campaignId ? [productionPlan.profile.campaignId] : [],
      templates: input.templateIds ?? productionPlan?.relationships.templates ?? [],
      knowledgeRecords: input.knowledgeRecordIds ?? [],
    };
  }
}
