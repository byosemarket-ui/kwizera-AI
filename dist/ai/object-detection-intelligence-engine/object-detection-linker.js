export class ObjectDetectionLinker {
    detectRelationships(record, allRecords, analysis, understanding, projects = [], knowledgeIds = []) {
        const relatedImages = [];
        for (const other of allRecords) {
            if (other.imageId === record.imageId)
                continue;
            const sharedBrand = other.logoDetection.brandAssociation === record.logoDetection.brandAssociation;
            const sharedProduct = record.productDetection.mainProduct &&
                other.productDetection.mainProduct === record.productDetection.mainProduct;
            if (sharedBrand || sharedProduct) {
                relatedImages.push(other.imageId);
            }
        }
        return {
            relatedProducts: [
                ...new Set([
                    ...(record.productDetection.mainProduct ? [record.productDetection.mainProduct] : []),
                    ...record.productDetection.secondaryProducts,
                    ...analysis.relationships.relatedProducts,
                ]),
            ],
            relatedBrands: [
                ...new Set([
                    record.logoDetection.brandAssociation,
                    ...analysis.relationships.relatedBrands,
                    ...understanding.relationships.relatedBrands,
                ]),
            ].filter((b) => b && b !== "unknown-brand"),
            relatedScenes: [understanding.scene.sceneType, understanding.scene.environment],
            relatedBackgrounds: [analysis.content.background],
            relatedCreativeStyles: [
                ...understanding.relationships.relatedCreativeStyles,
                analysis.classification.creativeStyle,
            ],
            relatedMarketingCampaigns: [
                ...analysis.relationships.relatedMarketingCampaigns,
                ...understanding.relationships.relatedMarketingCampaigns,
            ],
            relatedKnowledge: [
                ...new Set([
                    ...knowledgeIds,
                    ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
                    ...analysis.relationships.relatedKnowledge,
                    ...understanding.relationships.relatedKnowledge,
                ]),
            ],
            relatedImages: [...new Set([...relatedImages, ...analysis.relationships.relatedImages])].slice(0, 10),
            relatedProjects: [
                ...new Set([...projects, ...analysis.relationships.relatedProjects, ...understanding.relationships.relatedProjects]),
            ],
        };
    }
}
//# sourceMappingURL=object-detection-linker.js.map