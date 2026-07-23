export class CompositionLinker {
    detectRelationships(record, allRecords, analysis, understanding, detection, background, projects = [], knowledgeIds = []) {
        const relatedImages = [];
        for (const other of allRecords) {
            if (other.imageId === record.imageId)
                continue;
            const sharedType = other.compositionAnalysis.compositionType === record.compositionAnalysis.compositionType;
            const sharedBrand = other.relationships.relatedBrands.some((b) => record.relationships.relatedBrands.includes(b));
            const sharedProduct = other.relationships.relatedProducts.some((p) => record.relationships.relatedProducts.includes(p));
            if (sharedType || sharedBrand || sharedProduct) {
                relatedImages.push(other.imageId);
            }
        }
        return {
            relatedProducts: [
                ...new Set([
                    ...(detection.productDetection.mainProduct ? [detection.productDetection.mainProduct] : []),
                    ...detection.productDetection.secondaryProducts,
                    ...analysis.relationships.relatedProducts,
                ]),
            ],
            relatedBrands: [
                ...new Set([
                    detection.logoDetection.brandAssociation,
                    understanding.brand.brandIdentity,
                    ...analysis.relationships.relatedBrands,
                    ...understanding.relationships.relatedBrands,
                ]),
            ].filter((b) => b && b !== "unknown-brand"),
            relatedCreativeStyles: [
                ...understanding.relationships.relatedCreativeStyles,
                analysis.classification.creativeStyle,
            ],
            relatedBackgrounds: [
                ...new Set([
                    ...(background ? [background.backgroundLabel] : []),
                    analysis.content.background,
                    ...detection.relationships.relatedBackgrounds,
                ]),
            ].filter(Boolean),
            relatedStoryboards: [
                `storyboard-${record.compositionAnalysis.compositionType}`,
                `scene-${understanding.scene.sceneType}`,
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
                    ...(background?.relationships.relatedKnowledge ?? []),
                ]),
            ],
            relatedImages: [...new Set([...relatedImages, ...analysis.relationships.relatedImages])].slice(0, 10),
            relatedProjects: [
                ...new Set([
                    ...projects,
                    ...analysis.relationships.relatedProjects,
                    ...understanding.relationships.relatedProjects,
                    ...detection.relationships.relatedProjects,
                ]),
            ],
        };
    }
}
//# sourceMappingURL=composition-linker.js.map