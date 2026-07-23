export class ImageIntelligenceOptimizationLinker {
    detectRelationships(record, qualityPrediction, productionPlan) {
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
//# sourceMappingURL=image-intelligence-optimization-linker.js.map