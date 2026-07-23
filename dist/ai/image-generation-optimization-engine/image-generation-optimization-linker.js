export class ImageGenerationOptimizationLinker {
    detectRelationships(record, input, validation, productionPlan, renderPlan) {
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
            validationReports: input.validationId
                ? [input.validationId]
                : validation
                    ? [validation.qualityValidationId]
                    : [],
            products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            campaigns: productionPlan?.profile.campaignId ? [productionPlan.profile.campaignId] : [],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
        };
    }
}
//# sourceMappingURL=image-generation-optimization-linker.js.map