export class QualityPredictionLinker {
    detectRelationships(record, storyboard, scriptPlan, visualPlan, audioPlan, productionPlan, creative, strategy, understanding) {
        const knowledgeRecords = [
            ...new Set([
                ...understanding.relationships.knowledgeRecords,
                ...strategy.relationships.knowledgeRecords,
                ...creative.relationships.knowledgeRecords,
                ...storyboard.relationships.knowledgeRecords,
                ...scriptPlan.relationships.knowledgeRecords,
                ...visualPlan.relationships.knowledgeRecords,
                ...audioPlan.relationships.knowledgeRecords,
                ...productionPlan.relationships.knowledgeRecords,
            ]),
        ];
        return {
            storyboards: [record.storyboardId],
            scriptPlans: [record.scriptPlanId],
            visualPlans: [record.visualPlanId],
            audioPlans: [record.audioPlanId],
            productionPlans: [record.productionPlanId],
            marketingStrategies: [record.strategyId, ...storyboard.relationships.marketingStrategies],
            creativeDirections: [record.creativeId, ...storyboard.relationships.creativeDirections],
            knowledgeRecords,
        };
    }
}
//# sourceMappingURL=quality-prediction-linker.js.map