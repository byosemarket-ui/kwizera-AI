export class ProductionVideoLinker {
    detectRelationships(record, allRecords, analysis, understanding, enhancementPlan, creativePlan, projects = [], knowledgeIds = [], scriptIds = []) {
        const relatedProductionHistory = [];
        const relatedProductionPlans = [];
        for (const other of allRecords) {
            if (other.videoId === record.videoId)
                continue;
            if (other.profile.brand === record.profile.brand ||
                other.profile.campaign === record.profile.campaign) {
                relatedProductionHistory.push(other.profile.productionPlanId);
                relatedProductionPlans.push(other.profile.productionPlanId);
            }
        }
        return {
            relatedStoryboards: [
                ...new Set([
                    creativePlan.profile.creativeVideoId,
                    ...creativePlan.relationships.relatedStoryboards,
                ]),
            ],
            relatedProductionPlans: [...new Set(relatedProductionPlans)].slice(0, 10),
            relatedEnhancementPlans: [
                enhancementPlan.intelligenceId,
                ...creativePlan.relationships.relatedEnhancementPlans,
            ],
            relatedProducts: [
                ...new Set([
                    record.profile.product,
                    ...analysis.relationships.relatedProducts,
                    ...creativePlan.relationships.relatedProducts,
                ]),
            ].filter((p) => p && p !== "unspecified-product"),
            relatedBrands: [
                ...new Set([
                    record.profile.brand,
                    ...analysis.relationships.relatedBrands,
                    ...creativePlan.relationships.relatedBrands,
                ]),
            ].filter((b) => b && b !== "unknown-brand"),
            relatedCampaigns: [
                ...new Set([
                    record.profile.campaign,
                    ...analysis.relationships.relatedCampaigns,
                    ...creativePlan.relationships.relatedCampaigns,
                ]),
            ].filter(Boolean),
            relatedScripts: [
                ...new Set([
                    ...scriptIds,
                    ...creativePlan.relationships.relatedScripts,
                ]),
            ],
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
                    ...creativePlan.relationships.relatedProjects,
                ]),
            ],
        };
    }
}
//# sourceMappingURL=production-video-linker.js.map