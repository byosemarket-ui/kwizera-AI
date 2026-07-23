export class BrandVisualLinker {
    detectRelationships(record, allRecords, analysis, understanding, detection, projects = [], knowledgeIds = []) {
        const relatedImages = [];
        for (const other of allRecords) {
            if (other.imageId === record.imageId)
                continue;
            const sharedBrand = other.profile.brandName === record.profile.brandName;
            const sharedStyle = other.visualStyle === record.visualStyle;
            if (sharedBrand || sharedStyle) {
                relatedImages.push(other.imageId);
            }
        }
        return {
            relatedProducts: [
                ...new Set([
                    ...(detection.productDetection.mainProduct ? [detection.productDetection.mainProduct] : []),
                    ...detection.productDetection.secondaryProducts,
                    ...analysis.content.products,
                    ...analysis.relationships.relatedProducts,
                ]),
            ],
            relatedImages: [...new Set([...relatedImages, ...analysis.relationships.relatedImages])].slice(0, 10),
            relatedCampaigns: [
                ...analysis.relationships.relatedMarketingCampaigns,
                ...understanding.relationships.relatedMarketingCampaigns,
            ],
            relatedCreativeStyles: [
                record.profile.graphicStyle,
                ...understanding.relationships.relatedCreativeStyles,
                analysis.classification.creativeStyle,
            ],
            relatedStoryboards: [
                `storyboard-${record.visualStyle}`,
                `brand-${record.profile.brandId}`,
            ],
            relatedVisualPlans: [
                record.planning.visualStylePlan.slice(0, 50),
                record.planning.colorApplicationPlan.slice(0, 50),
            ],
            relatedMarketingStrategies: [
                understanding.marketing.promotionalPurpose,
                understanding.marketing.marketingOpportunity,
            ].filter(Boolean),
            relatedKnowledge: [
                ...new Set([
                    ...knowledgeIds,
                    ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
                    ...analysis.relationships.relatedKnowledge,
                    ...understanding.relationships.relatedKnowledge,
                ]),
            ],
            relatedProjects: [
                ...new Set([
                    ...projects,
                    ...analysis.relationships.relatedProjects,
                    ...understanding.relationships.relatedProjects,
                ]),
            ],
        };
    }
}
//# sourceMappingURL=brand-visual-linker.js.map