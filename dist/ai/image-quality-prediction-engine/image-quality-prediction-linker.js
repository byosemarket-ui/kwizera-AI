export class ImageQualityPredictionLinker {
    detectRelationships(record, allRecords, analysis, understanding, productionPlan, creativePlan, enhancementPlan, projects = [], knowledgeIds = []) {
        const relatedProductionHistory = [];
        for (const other of allRecords) {
            if (other.imageId === record.imageId)
                continue;
            if (other.profile.brand === record.profile.brand ||
                other.profile.campaign === record.profile.campaign) {
                relatedProductionHistory.push(other.profile.predictionId);
            }
        }
        return {
            relatedImagePlans: [productionPlan.profile.productionImagePlanId],
            relatedCreativePlans: [creativePlan.profile.creativeImageId],
            relatedProducts: [
                ...new Set([
                    record.profile.product,
                    ...analysis.content.products,
                    ...productionPlan.relationships.relatedProducts,
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
                    ...productionPlan.relationships.relatedCampaigns,
                ]),
            ],
            relatedKnowledge: [
                ...new Set([
                    ...knowledgeIds,
                    ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
                    ...analysis.relationships.relatedKnowledge,
                    ...understanding.relationships.relatedKnowledge,
                    ...enhancementPlan.relationships.relatedKnowledge,
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
                    ...productionPlan.relationships.relatedProjects,
                ]),
            ],
        };
    }
}
//# sourceMappingURL=image-quality-prediction-linker.js.map