export class ImageToImageGenerationLinker {
    detectRelationships(record, input, textToImagePlan, creative, strategy, understanding) {
        const relationships = {
            sourceImages: [record.profile.sourceImageId],
            generatedImages: [record.profile.generatedImageId],
            products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: input.campaignId ? [input.campaignId] : [],
            prompts: [record.profile.promptId],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
            textToImagePlans: input.textToImagePlanId ? [input.textToImagePlanId] : textToImagePlan ? [textToImagePlan.imagePlanId] : [],
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
//# sourceMappingURL=image-to-image-generation-linker.js.map