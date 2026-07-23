export class VideoIntelligenceOptimizationLinker {
    detectRelationships(record, qualityPrediction, productionPlan) {
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
//# sourceMappingURL=video-intelligence-optimization-linker.js.map