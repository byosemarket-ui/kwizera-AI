export class ScriptPlanningLinker {
    detectRelationships(record, allRecords, storyboard, creative, strategy, understanding) {
        const audioPlans = [];
        const productionPlans = [];
        if (record.productionReady) {
            audioPlans.push(`audio-prep-${record.scriptPlanId}`);
            productionPlans.push(`production-prep-${record.scriptPlanId}`);
        }
        audioPlans.push(...storyboard.relationships.audioPlans);
        productionPlans.push(...storyboard.relationships.productionPlans);
        const knowledgeRecords = [
            ...new Set([
                ...understanding.relationships.knowledgeRecords,
                ...strategy.relationships.knowledgeRecords,
                ...creative.relationships.knowledgeRecords,
                ...storyboard.relationships.knowledgeRecords,
            ]),
        ];
        return {
            storyboards: [record.storyboardId],
            creativeDirections: [record.creativeId, ...storyboard.relationships.creativeDirections],
            marketingStrategies: [record.strategyId, ...storyboard.relationships.marketingStrategies],
            products: [record.productId],
            brands: [creative.profile.brand],
            languages: [record.profile.language],
            audioPlans: [...new Set(audioPlans)].slice(0, 10),
            productionPlans: [...new Set(productionPlans)].slice(0, 10),
            knowledgeRecords,
        };
    }
}
//# sourceMappingURL=script-planning-linker.js.map