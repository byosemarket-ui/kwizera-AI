import type { VideoQualityPredictionRecord } from "../video-quality-prediction-engine/types.js";

import type { ProductionVideoPlanningRecord } from "../production-video-planning-engine/types.js";

import {

  VideoIntelligenceOptimizationRecord,

  VideoIntelligenceOptimizationRelationships,

} from "./types.js";



export class VideoIntelligenceOptimizationLinker {

  detectRelationships(

    record: VideoIntelligenceOptimizationRecord,

    qualityPrediction: VideoQualityPredictionRecord,

    productionPlan: ProductionVideoPlanningRecord

  ): VideoIntelligenceOptimizationRelationships {

    return {

      relatedStoryboards: qualityPrediction.relationships.relatedStoryboards,

      relatedProductionPlans: [productionPlan.profile.productionPlanId],

      relatedEnhancementPlans: [qualityPrediction.enhancementPlanId],

      relatedProducts: qualityPrediction.relationships.relatedProducts,

      relatedBrands: qualityPrediction.relationships.relatedBrands,

      relatedCampaigns: qualityPrediction.relationships.relatedCampaigns,

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


