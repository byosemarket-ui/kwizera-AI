export class AudioPlanningLinker {
    detectRelationships(record, storyboard, scriptPlan, visualPlan, creative, strategy, understanding) {
        const productionPlans = [];
        if (record.productionReady) {
            productionPlans.push(`production-prep-${record.audioPlanId}`);
        }
        productionPlans.push(...visualPlan.relationships.productionPlans);
        productionPlans.push(...scriptPlan.relationships.productionPlans);
        productionPlans.push(...storyboard.relationships.productionPlans);
        const knowledgeRecords = [
            ...new Set([
                ...understanding.relationships.knowledgeRecords,
                ...strategy.relationships.knowledgeRecords,
                ...creative.relationships.knowledgeRecords,
                ...storyboard.relationships.knowledgeRecords,
                ...scriptPlan.relationships.knowledgeRecords,
                ...visualPlan.relationships.knowledgeRecords,
            ]),
        ];
        return {
            storyboards: [record.storyboardId],
            scriptPlans: [record.scriptPlanId],
            visualPlans: [record.visualPlanId],
            creativeDirections: [record.creativeId, ...storyboard.relationships.creativeDirections],
            marketingStrategies: [record.strategyId, ...storyboard.relationships.marketingStrategies],
            brands: [creative.profile.brand],
            languages: [record.profile.language],
            productionPlans: [...new Set(productionPlans)].slice(0, 10),
            knowledgeRecords,
        };
    }
}
//# sourceMappingURL=audio-planning-linker.js.map