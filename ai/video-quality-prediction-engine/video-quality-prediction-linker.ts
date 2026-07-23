import type { VideoAnalysisIntelligenceRecord } from "../video-analysis-engine/types.js";

import type { VideoUnderstandingRecord } from "../video-understanding-engine/types.js";

import type { VideoEnhancementPlanRecord } from "../video-enhancement-planning-engine/types.js";

import type { CreativeVideoIntelligenceRecord } from "../creative-video-intelligence-engine/types.js";

import type { ProductionVideoPlanningRecord } from "../production-video-planning-engine/types.js";

import { VideoQualityPredictionRecord, VideoQualityPredictionRelationships } from "./types.js";



export class VideoQualityPredictionLinker {

  detectRelationships(

    record: VideoQualityPredictionRecord,

    allRecords: VideoQualityPredictionRecord[],

    analysis: VideoAnalysisIntelligenceRecord,

    understanding: VideoUnderstandingRecord,

    productionPlan: ProductionVideoPlanningRecord,

    creativePlan: CreativeVideoIntelligenceRecord,

    enhancementPlan: VideoEnhancementPlanRecord,

    projects: string[] = [],

    knowledgeIds: string[] = [],

    scriptIds: string[] = []

  ): VideoQualityPredictionRelationships {

    const relatedProductionHistory: string[] = [];



    for (const other of allRecords) {

      if (other.videoId === record.videoId) continue;

      if (

        other.profile.brand === record.profile.brand ||

        other.profile.campaign === record.profile.campaign

      ) {

        relatedProductionHistory.push(other.profile.predictionId);

      }

    }



    return {

      relatedStoryboards: [

        ...new Set([

          creativePlan.profile.creativeVideoId,

          ...creativePlan.relationships.relatedStoryboards,

          ...productionPlan.relationships.relatedStoryboards,

        ]),

      ],

      relatedProductionPlans: [productionPlan.profile.productionPlanId],

      relatedProducts: [

        ...new Set([

          record.profile.product,

          ...analysis.relationships.relatedProducts,

          ...productionPlan.relationships.relatedProducts,

          ...creativePlan.relationships.relatedProducts,

        ]),

      ].filter((p) => p && p !== "unspecified-product"),

      relatedBrands: [

        ...new Set([

          record.profile.brand,

          ...analysis.relationships.relatedBrands,

          ...understanding.relationships.relatedBrands,

          ...productionPlan.relationships.relatedBrands,

        ]),

      ].filter((b) => b && b !== "unknown-brand"),

      relatedCampaigns: [

        ...new Set([

          record.profile.campaign,

          ...analysis.relationships.relatedCampaigns,

          ...understanding.relationships.relatedCampaigns,

          ...productionPlan.relationships.relatedCampaigns,

        ]),

      ],

      relatedScripts: [

        ...new Set([

          ...scriptIds,

          ...understanding.relationships.relatedScripts,

          ...creativePlan.relationships.relatedScripts,

          ...productionPlan.relationships.relatedScripts,

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

          ...productionPlan.relationships.relatedKnowledge,

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


