export class ImageQualityValidationLinker {
    detectRelationships(record, input, productionPlan, renderPlan) {
        return {
            imagePlans: record.profile.imagePlanId ? [record.profile.imagePlanId] : [],
            productionPlans: input.productionId
                ? [input.productionId]
                : productionPlan
                    ? [productionPlan.imageProductionId]
                    : [],
            renderPlans: input.renderPlanId
                ? [input.renderPlanId]
                : renderPlan
                    ? [renderPlan.imageRenderPlanId]
                    : [],
            products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: productionPlan?.profile.campaignId ? [productionPlan.profile.campaignId] : [],
            templates: input.templateIds ?? productionPlan?.relationships.templates ?? [],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
        };
    }
}
//# sourceMappingURL=image-quality-validation-linker.js.map