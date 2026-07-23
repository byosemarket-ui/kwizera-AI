export class ImageRenderLinker {
    detectRelationships(record, input, productionPlan, stylePlan, productId) {
        return {
            imagePlans: productionPlan ? [productionPlan.profile.imagePlanId] : stylePlan ? [stylePlan.stylePlanId] : [],
            productionPlans: input.productionId
                ? [input.productionId]
                : productionPlan
                    ? [productionPlan.imageProductionId]
                    : [],
            renderPlans: [record.imageRenderPlanId],
            products: productId ? [productId] : productionPlan ? [productionPlan.profile.productId] : [],
            brands: productionPlan?.profile.brandId ? [productionPlan.profile.brandId] : input.brandId ? [input.brandId] : [],
            campaigns: productionPlan?.profile.campaignId ? [productionPlan.profile.campaignId] : [],
            templates: input.templateIds ?? productionPlan?.relationships.templates ?? [],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
            stylePlans: input.stylePlanId
                ? [input.stylePlanId]
                : stylePlan
                    ? [stylePlan.stylePlanId]
                    : productionPlan?.relationships.stylePlans ?? [],
        };
    }
}
//# sourceMappingURL=image-render-linker.js.map