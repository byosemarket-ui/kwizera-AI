export class CreativeImageLinker {
    detectRelationships(record, allRecords, analysis, understanding, composition, brandVisual, enhancementPlan, projects = [], knowledgeIds = []) {
        const relatedVisualPlans = [];
        for (const other of allRecords) {
            if (other.imageId === record.imageId)
                continue;
            if (other.profile.brand === record.profile.brand ||
                other.profile.campaign === record.profile.campaign) {
                relatedVisualPlans.push(other.profile.creativeImageId);
            }
        }
        return {
            relatedProducts: [
                ...new Set([record.profile.product, ...analysis.content.products, ...analysis.relationships.relatedProducts]),
            ].filter((p) => p && p !== "unspecified-product"),
            relatedBrands: [
                ...new Set([
                    record.profile.brand,
                    brandVisual.profile.brandName,
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
            relatedCreativeStyles: [
                record.creativeStyle.primaryStyle,
                record.creativeStyle.secondaryStyle,
                analysis.classification.creativeStyle,
                ...understanding.relationships.relatedCreativeStyles,
            ].filter(Boolean),
            relatedMarketingStrategy: [
                understanding.marketingGoal,
                ...understanding.relationships.relatedMarketingCampaigns,
            ].filter(Boolean),
            relatedVisualPlans: [...new Set(relatedVisualPlans)].slice(0, 10),
            relatedEnhancementPlans: enhancementPlan
                ? [enhancementPlan.profile.enhancementPlanId]
                : [],
            relatedCompositionIntelligence: [composition.compositionId],
            relatedBrandVisualIntelligence: [brandVisual.brandVisualId],
            relatedProjects: [
                ...new Set([
                    record.profile.projectId,
                    ...projects,
                    ...analysis.relationships.relatedProjects,
                    ...understanding.relationships.relatedProjects,
                ]),
            ],
            relatedKnowledge: [
                ...new Set([
                    ...knowledgeIds,
                    ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
                    ...analysis.relationships.relatedKnowledge,
                    ...understanding.relationships.relatedKnowledge,
                ]),
            ],
        };
    }
}
//# sourceMappingURL=creative-image-linker.js.map