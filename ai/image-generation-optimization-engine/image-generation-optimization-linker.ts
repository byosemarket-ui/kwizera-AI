import type { ImageQualityValidationRecord } from "../image-quality-validation-engine/types.js";
import type { ImageProductionRecord } from "../image-production-engine/types.js";
import type { ImageRenderRecord } from "../image-rendering-preparation-engine/types.js";
import {
  ImageGenerationOptimizationInput,
  ImageGenerationOptimizationRecord,
  OptimizationRelationships,
} from "./types.js";

export class ImageGenerationOptimizationLinker {
  detectRelationships(
    record: ImageGenerationOptimizationRecord,
    input: ImageGenerationOptimizationInput,
    validation?: ImageQualityValidationRecord | null,
    productionPlan?: ImageProductionRecord | null,
    renderPlan?: ImageRenderRecord | null
  ): OptimizationRelationships {
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
      validationReports: input.validationId
        ? [input.validationId]
        : validation
          ? [validation.qualityValidationId]
          : [],
      products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
      brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
      campaigns: productionPlan?.profile.campaignId ? [productionPlan.profile.campaignId] : [],
      knowledgeRecords: input.knowledgeRecordIds ?? [],
    };
  }
}
