export class ProductionPlanningLinker {
    detectRelationships(record, storyboard, scriptPlan, visualPlan, audioPlan, creative, strategy, understanding) {
        const knowledgeRecords = [
            ...new Set([
                ...understanding.relationships.knowledgeRecords,
                ...strategy.relationships.knowledgeRecords,
                ...creative.relationships.knowledgeRecords,
                ...storyboard.relationships.knowledgeRecords,
                ...scriptPlan.relationships.knowledgeRecords,
                ...visualPlan.relationships.knowledgeRecords,
                ...audioPlan.relationships.knowledgeRecords,
            ]),
        ];
        const productionHistory = [
            `production-v${record.version}-${record.productionPlanId}`,
            ...audioPlan.relationships.productionPlans.filter((p) => p.startsWith("production-prep")),
        ];
        return {
            storyboards: [record.storyboardId],
            scriptPlans: [record.scriptPlanId],
            visualPlans: [record.visualPlanId],
            audioPlans: [record.audioPlanId],
            creativeDirections: [record.creativeId, ...storyboard.relationships.creativeDirections],
            marketingStrategies: [record.strategyId, ...storyboard.relationships.marketingStrategies],
            products: [record.productId],
            brands: [creative.profile.brand],
            knowledgeRecords,
            productionHistory: [...new Set(productionHistory)].slice(0, 10),
        };
    }
}
//# sourceMappingURL=production-planning-linker.js.map