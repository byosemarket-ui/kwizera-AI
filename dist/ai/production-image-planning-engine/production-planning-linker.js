export class ProductionPlanningLinker {
    detectRelationships(record, allRecords, analysis, understanding, enhancementPlan, creativePlan, projects = [], knowledgeIds = []) {
        const relatedProductionHistory = [];
        for (const other of allRecords) {
            if (other.imageId === record.imageId)
                continue;
            if (other.profile.brand === record.profile.brand ||
                other.profile.campaign === record.profile.campaign) {
                relatedProductionHistory.push(other.profile.productionImagePlanId);
            }
        }
        return {
            relatedCreativeImagePlans: [creativePlan.profile.creativeImageId],
            relatedEnhancementPlans: [enhancementPlan.profile.enhancementPlanId],
            relatedProducts: [
                ...new Set([
                    record.profile.product,
                    ...analysis.content.products,
                    ...analysis.relationships.relatedProducts,
                ]),
            ].filter((p) => p && p !== "unspecified-product"),
            relatedBrands: [
                ...new Set([
                    record.profile.brand,
                    ...analysis.relationships.relatedBrands,
                    ...understanding.relationships.relatedBrands,
                ]),
            ].filter((b) => b && b !== "unknown-brand"),
            relatedCampaigns: [
                ...new Set([
                    record.profile.campaign,
                    ...understanding.relationships.relatedMarketingCampaigns,
                ]),
            ],
            relatedMarketingStrategy: [
                understanding.marketingGoal,
                ...understanding.relationships.relatedMarketingCampaigns,
            ].filter(Boolean),
            relatedKnowledge: [
                ...new Set([
                    ...knowledgeIds,
                    ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
                    ...analysis.relationships.relatedKnowledge,
                    ...understanding.relationships.relatedKnowledge,
                    ...creativePlan.relationships.relatedKnowledge,
                ]),
            ],
            relatedProductionHistory: [...new Set(relatedProductionHistory)].slice(0, 10),
            relatedProjects: [
                ...new Set([
                    record.profile.projectId,
                    ...projects,
                    ...analysis.relationships.relatedProjects,
                    ...understanding.relationships.relatedProjects,
                ]),
            ],
        };
    }
}
//# sourceMappingURL=production-planning-linker.js.map