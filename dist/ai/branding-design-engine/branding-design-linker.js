export class BrandingDesignLinker {
    detectRelationships(record, input, productImagePlan, enhancementPlan, creative, strategy, understanding) {
        const relationships = {
            brands: record.profile.brandId !== "unknown-brand" ? [record.profile.brandId] : [],
            products: record.profile.productId !== "unknown-product" ? [record.profile.productId] : [],
            campaigns: record.profile.campaignId ? [record.profile.campaignId] : [],
            templates: input.templateIds ?? [],
            images: input.imageIds ?? [],
            logos: input.logoIds ?? [`logo-${record.profile.brandId}`],
            knowledgeRecords: input.knowledgeRecordIds ?? [],
            productImagePlans: input.productImagePlanId
                ? [input.productImagePlanId]
                : productImagePlan
                    ? [productImagePlan.productImagePlanId]
                    : [],
            enhancementPlans: input.enhancementPlanId
                ? [input.enhancementPlanId]
                : enhancementPlan
                    ? [enhancementPlan.enhancementPlanId]
                    : [],
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
//# sourceMappingURL=branding-design-linker.js.map