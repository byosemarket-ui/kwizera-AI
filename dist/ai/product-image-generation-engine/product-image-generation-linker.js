export class ProductImageGenerationLinker {
    detectRelationships(record, input, creative, strategy, understanding) {
        const relationships = {
            products: [record.profile.productId],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: record.profile.campaignId ? [record.profile.campaignId] : [],
            sourceImages: input.sourceImageIds ?? [],
            generatedImages: [`gen-${record.productImagePlanId}`],
            templates: input.styleReferenceIds ?? [],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
            textToImagePlans: input.textToImagePlanId ? [input.textToImagePlanId] : [],
            imageToImagePlans: [],
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
//# sourceMappingURL=product-image-generation-linker.js.map