export class TextToImageGenerationLinker {
    detectRelationships(record, input, creative, strategy, understanding) {
        const relationships = {
            prompts: [record.profile.promptId],
            products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: input.campaignId ? [input.campaignId] : [],
            images: [record.imagePlanId],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
            productionPlans: [],
            creativeDirections: creative ? [creative.creativeId] : [],
            marketingStrategies: strategy ? [strategy.strategyId] : [],
        };
        if (understanding?.productId && !relationships.products.includes(understanding.productId)) {
            relationships.products.push(understanding.productId);
        }
        if (creative?.profile.brand && !relationships.brands.includes(creative.profile.brand)) {
            relationships.brands.push(creative.profile.brand);
        }
        return relationships;
    }
}
//# sourceMappingURL=text-to-image-generation-linker.js.map