export class ImageEnhancementLinker {
    detectRelationships(record, input, productImagePlan, backgroundPlan, editingPlan, creative, strategy, understanding) {
        const relationships = {
            sourceImages: [record.profile.sourceImageId],
            enhancedImages: [record.profile.enhancedImageId],
            restoredImages: [record.profile.restoredImageId],
            products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: record.profile.campaignId ? [record.profile.campaignId] : [],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
            imageEditingPlans: input.imageEditingPlanId
                ? [input.imageEditingPlanId]
                : editingPlan
                    ? [editingPlan.imageEditingPlanId]
                    : [],
            productImagePlans: input.productImagePlanId
                ? [input.productImagePlanId]
                : productImagePlan
                    ? [productImagePlan.productImagePlanId]
                    : [],
            backgroundPlans: input.backgroundPlanId
                ? [input.backgroundPlanId]
                : backgroundPlan
                    ? [backgroundPlan.backgroundPlanId]
                    : [],
        };
        if (input.editedImageId && !relationships.enhancedImages.includes(input.editedImageId)) {
            relationships.enhancedImages.push(input.editedImageId);
        }
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
//# sourceMappingURL=image-enhancement-linker.js.map