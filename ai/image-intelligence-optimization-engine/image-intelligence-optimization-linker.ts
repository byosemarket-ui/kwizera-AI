import type { ImageQualityPredictionRecord } from "../image-quality-prediction-engine/types.js";
import type { ProductionImagePlanningRecord } from "../production-image-planning-engine/types.js";
import {
  ImageIntelligenceOptimizationRecord,
  ImageIntelligenceOptimizationRelationships,
} from "./types.js";

export class ImageIntelligenceOptimizationLinker {
  detectRelationships(
    record: ImageIntelligenceOptimizationRecord,
    qualityPrediction: ImageQualityPredictionRecord,
    productionPlan: ProductionImagePlanningRecord
  ): ImageIntelligenceOptimizationRelationships {
    return {
      relatedImagePlans: qualityPrediction.relationships.relatedImagePlans,
      relatedCreativePlans: qualityPrediction.relationships.relatedCreativePlans,
      relatedEnhancementPlans: [qualityPrediction.enhancementPlanId],
      relatedProducts: qualityPrediction.relationships.relatedProducts,
      relatedBrands: qualityPrediction.relationships.relatedBrands,
      relatedCampaigns: qualityPrediction.relationships.relatedCampaigns,
      productionPlans: [productionPlan.profile.productionImagePlanId],
      qualityPredictions: [qualityPrediction.profile.predictionId],
      knowledgeRecords: [
        ...new Set([
          ...qualityPrediction.relationships.relatedKnowledge,
          ...productionPlan.relationships.relatedKnowledge,
        ]),
      ],
    };
  }
}
