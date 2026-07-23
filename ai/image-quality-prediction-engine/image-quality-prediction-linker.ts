import type { CreativeImageIntelligenceRecord } from "../creative-image-intelligence-engine/types.js";
import type { ImageEnhancementPlanningRecord } from "../image-enhancement-planning-engine/types.js";
import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import type { ProductionImagePlanningRecord } from "../production-image-planning-engine/types.js";
import { ImageQualityPredictionRecord, ImageQualityPredictionRelationships } from "./types.js";

export class ImageQualityPredictionLinker {
  detectRelationships(
    record: ImageQualityPredictionRecord,
    allRecords: ImageQualityPredictionRecord[],
    analysis: ImageAnalysisIntelligenceRecord,
    understanding: ImageUnderstandingRecord,
    productionPlan: ProductionImagePlanningRecord,
    creativePlan: CreativeImageIntelligenceRecord,
    enhancementPlan: ImageEnhancementPlanningRecord,
    projects: string[] = [],
    knowledgeIds: string[] = []
  ): ImageQualityPredictionRelationships {
    const relatedProductionHistory: string[] = [];

    for (const other of allRecords) {
      if (other.imageId === record.imageId) continue;
      if (
        other.profile.brand === record.profile.brand ||
        other.profile.campaign === record.profile.campaign
      ) {
        relatedProductionHistory.push(other.profile.predictionId);
      }
    }

    return {
      relatedImagePlans: [productionPlan.profile.productionImagePlanId],
      relatedCreativePlans: [creativePlan.profile.creativeImageId],
      relatedProducts: [
        ...new Set([
          record.profile.product,
          ...analysis.content.products,
          ...productionPlan.relationships.relatedProducts,
        ]),
      ].filter((p) => p && p !== "unspecified-product"),
      relatedBrands: [
        ...new Set([
          record.profile.brand,
          ...analysis.relationships.relatedBrands,
          ...understanding.relationships.relatedBrands,
        ]),
      ].filter((b) => b && b !== "unknown-brand"),
      relatedCampaigns: [
        ...new Set([
          record.profile.campaign,
          ...understanding.relationships.relatedMarketingCampaigns,
          ...productionPlan.relationships.relatedCampaigns,
        ]),
      ],
      relatedKnowledge: [
        ...new Set([
          ...knowledgeIds,
          ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
          ...analysis.relationships.relatedKnowledge,
          ...understanding.relationships.relatedKnowledge,
          ...enhancementPlan.relationships.relatedKnowledge,
          ...creativePlan.relationships.relatedKnowledge,
        ]),
      ],
      relatedProductionHistory: [...new Set(relatedProductionHistory)].slice(0, 10),
      relatedProjects: [
        ...new Set([
          record.profile.projectId,
          ...projects,
          ...analysis.relationships.relatedProjects,
          ...understanding.relationships.relatedProjects,
          ...productionPlan.relationships.relatedProjects,
        ]),
      ],
    };
  }
}
