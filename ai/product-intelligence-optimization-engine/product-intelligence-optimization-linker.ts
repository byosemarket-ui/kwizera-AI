import type { QualityPredictionRecord } from "../quality-prediction-engine/types.js";
import type { ProductionPlanningRecord } from "../production-planning-engine/types.js";
import { ProductIntelligenceOptimizationRecord, ProductIntelligenceOptimizationRelationships } from "./types.js";

export class ProductIntelligenceOptimizationLinker {
  detectRelationships(
    record: ProductIntelligenceOptimizationRecord,
    qualityPrediction: QualityPredictionRecord,
    productionPlan: ProductionPlanningRecord
  ): ProductIntelligenceOptimizationRelationships {
    return {
      storyboards: qualityPrediction.relationships.storyboards,
      scriptPlans: qualityPrediction.relationships.scriptPlans,
      visualPlans: qualityPrediction.relationships.visualPlans,
      audioPlans: qualityPrediction.relationships.audioPlans,
      productionPlans: [productionPlan.productionPlanId],
      qualityPredictions: [qualityPrediction.predictionId],
      knowledgeRecords: [
        ...new Set([
          ...qualityPrediction.relationships.knowledgeRecords,
          ...productionPlan.relationships.knowledgeRecords,
        ]),
      ],
    };
  }
}
