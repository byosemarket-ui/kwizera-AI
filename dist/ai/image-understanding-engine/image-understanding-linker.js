export class ImageUnderstandingLinker {
    detectRelationships(record, allRecords, analysis, projects = [], knowledgeIds = [], storyboards = []) {
        const relatedImages = [];
        const relatedBrands = [
            record.brand.brandIdentity,
            ...analysis.relationships.relatedBrands,
        ].filter((b) => b && b !== "unknown-brand");
        const relatedProducts = [
            ...analysis.content.products,
            ...analysis.relationships.relatedProducts,
        ];
        const relatedCreativeStyles = [record.context.creativeContext, analysis.classification.creativeStyle];
        for (const other of allRecords) {
            if (other.imageId === record.imageId)
                continue;
            if (other.brand.brandIdentity === record.brand.brandIdentity) {
                relatedImages.push(other.imageId);
            }
            else if (other.scene.sceneType === record.scene.sceneType) {
                relatedImages.push(other.imageId);
            }
            else if (other.product.productContext === record.product.productContext && record.product.productContext !== "no product focus") {
                relatedImages.push(other.imageId);
            }
        }
        const relatedCampaigns = [...analysis.relationships.relatedMarketingCampaigns];
        if (record.marketingGoal)
            relatedCampaigns.push(`${record.marketingGoal}-campaign`);
        return {
            relatedProducts: [...new Set([...relatedProducts, ...analysis.content.products])],
            relatedBrands: [...new Set(relatedBrands)],
            relatedProjects: [...new Set([...projects, ...analysis.relationships.relatedProjects])],
            relatedMarketingCampaigns: [...new Set(relatedCampaigns)],
            relatedCreativeStyles: [...new Set(relatedCreativeStyles.filter(Boolean))],
            relatedKnowledge: [
                ...new Set([
                    ...knowledgeIds,
                    ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
                    ...analysis.relationships.relatedKnowledge,
                ]),
            ],
            relatedImages: [...new Set([...relatedImages, ...analysis.relationships.relatedImages])].slice(0, 10),
            relatedStoryboards: [...new Set(storyboards)],
            relatedMemory: [...new Set(analysis.relationships.relatedMemory)],
        };
    }
}
//# sourceMappingURL=image-understanding-linker.js.map