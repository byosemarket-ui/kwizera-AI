export class ImageProductionLinker {
    detectRelationships(record, input, productImagePlan, brandingPlan, stylePlan) {
        const relationships = {
            imagePlans: [record.profile.imagePlanId],
            productionPlans: [record.imageProductionId],
            products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: record.profile.campaignId ? [record.profile.campaignId] : [],
            templates: input.templateIds ?? [],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
            stylePlans: input.stylePlanId
                ? [input.stylePlanId]
                : stylePlan
                    ? [stylePlan.stylePlanId]
                    : [],
            brandingPlans: input.brandingPlanId
                ? [input.brandingPlanId]
                : brandingPlan
                    ? [brandingPlan.brandDesignId]
                    : [],
            productImagePlans: input.productImagePlanId
                ? [input.productImagePlanId]
                : productImagePlan
                    ? [productImagePlan.productImagePlanId]
                    : [],
            generatedImages: stylePlan ? [stylePlan.profile.generatedStyleImageId] : [],
            sourceImages: stylePlan
                ? [stylePlan.profile.sourceImageId]
                : productImagePlan
                    ? [productImagePlan.productImagePlanId]
                    : [],
        };
        if (productImagePlan && !relationships.sourceImages.includes(productImagePlan.productImagePlanId)) {
            relationships.sourceImages.push(productImagePlan.productImagePlanId);
        }
        return relationships;
    }
}
//# sourceMappingURL=image-production-linker.js.map