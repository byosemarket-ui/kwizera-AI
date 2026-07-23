export class BackgroundGenerationLinker {
    detectRelationships(record, input, productImagePlan, creative, strategy, understanding) {
        const relationships = {
            sourceImages: [record.profile.sourceImageId],
            generatedImages: [record.profile.generatedBackgroundId],
            products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: record.profile.campaignId ? [record.profile.campaignId] : [],
            prompts: [record.profile.promptId],
            templates: input.styleReferenceIds ?? [],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
            productImagePlans: input.productImagePlanId ? [input.productImagePlanId] : productImagePlan ? [productImagePlan.productImagePlanId] : [],
        };
        if (understanding?.productId && !relationships.products.includes(understanding.productId)) {
            relationships.products.push(understanding.productId);
        }
        if (creative?.profile.brand && !relationships.brands.includes(creative.profile.brand)) {
            relationships.brands.push(creative.profile.brand);
        }
        if (strategy?.relationships.campaigns.length) {
            relationships.campaigns.push(...strategy.relationships.campaigns.filter((c) => !relationships.campaigns.includes(c)));
        }
        return relationships;
    }
}
//# sourceMappingURL=background-generation-linker.js.map