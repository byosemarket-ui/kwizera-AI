export class VisualPlanningLinker {
    detectRelationships(record, storyboard, scriptPlan, creative, strategy, understanding) {
        const audioPlans = [];
        const productionPlans = [];
        if (record.productionReady) {
            audioPlans.push(`audio-prep-${record.scriptPlanId}`);
            productionPlans.push(`production-prep-${record.visualPlanId}`);
        }
        audioPlans.push(...scriptPlan.relationships.audioPlans);
        productionPlans.push(...scriptPlan.relationships.productionPlans);
        productionPlans.push(...storyboard.relationships.productionPlans);
        const knowledgeRecords = [
            ...new Set([
                ...understanding.relationships.knowledgeRecords,
                ...strategy.relationships.knowledgeRecords,
                ...creative.relationships.knowledgeRecords,
                ...storyboard.relationships.knowledgeRecords,
                ...scriptPlan.relationships.knowledgeRecords,
            ]),
        ];
        return {
            storyboards: [record.storyboardId],
            scriptPlans: [record.scriptPlanId],
            creativeDirections: [record.creativeId, ...storyboard.relationships.creativeDirections],
            marketingStrategies: [record.strategyId, ...storyboard.relationships.marketingStrategies],
            products: [record.productId],
            brands: [creative.profile.brand],
            audioPlans: [...new Set(audioPlans)].slice(0, 10),
            productionPlans: [...new Set(productionPlans)].slice(0, 10),
            knowledgeRecords,
        };
    }
}
//# sourceMappingURL=visual-planning-linker.js.map