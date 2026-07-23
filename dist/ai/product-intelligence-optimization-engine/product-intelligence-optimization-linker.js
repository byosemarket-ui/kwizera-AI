export class ProductIntelligenceOptimizationLinker {
    detectRelationships(record, qualityPrediction, productionPlan) {
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
//# sourceMappingURL=product-intelligence-optimization-linker.js.map