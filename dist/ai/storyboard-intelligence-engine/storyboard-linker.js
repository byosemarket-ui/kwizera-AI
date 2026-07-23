export class StoryboardLinker {
    detectRelationships(record, allRecords, creative, strategy, understanding) {
        const creativeDirections = [record.creativeId, ...creative.relationships.creativeStyles.map(String)];
        const products = [record.productId];
        const brands = [creative.profile.brand];
        const marketingStrategies = [record.strategyId];
        const scripts = [];
        const visualPlans = [];
        const audioPlans = [];
        const productionPlans = [];
        if (record.productionReady) {
            scripts.push(`script-prep-${record.storyboardId}`);
            visualPlans.push(`visual-prep-${record.storyboardId}`);
            audioPlans.push(`audio-prep-${record.storyboardId}`);
            productionPlans.push(`production-prep-${record.storyboardId}`);
        }
        scripts.push(...creative.relationships.scripts);
        visualPlans.push(...creative.relationships.visualPlans);
        audioPlans.push(...creative.relationships.audioPlans);
        const knowledgeRecords = [
            ...new Set([
                ...understanding.relationships.knowledgeRecords,
                ...strategy.relationships.knowledgeRecords,
                ...creative.relationships.knowledgeRecords,
            ]),
        ];
        for (const other of allRecords) {
            if (other.storyboardId === record.storyboardId)
                continue;
            if (other.profile.platform === record.profile.platform) {
                productionPlans.push(`related-${other.storyboardId}`);
            }
        }
        return {
            creativeDirections: [...new Set(creativeDirections)],
            products: [...new Set(products)],
            brands: [...new Set(brands)],
            marketingStrategies: [...new Set(marketingStrategies)],
            scripts: [...new Set(scripts)],
            visualPlans: [...new Set(visualPlans)],
            audioPlans: [...new Set(audioPlans)],
            productionPlans: [...new Set(productionPlans)].slice(0, 10),
            knowledgeRecords,
        };
    }
}
//# sourceMappingURL=storyboard-linker.js.map