export class BackgroundLinker {
    detectRelationships(record, allRecords, analysis, understanding, detection, projects = [], knowledgeIds = []) {
        const relatedImages = [];
        const relatedBackgrounds = [record.backgroundLabel];
        for (const other of allRecords) {
            if (other.imageId === record.imageId)
                continue;
            const sharedType = other.classification.backgroundType === record.classification.backgroundType;
            const sharedBrand = other.relationships.relatedBrands.some((b) => record.relationships.relatedBrands.includes(b));
            const sharedBackground = other.backgroundLabel === record.backgroundLabel;
            if (sharedType || sharedBrand || sharedBackground) {
                relatedImages.push(other.imageId);
                if (!relatedBackgrounds.includes(other.backgroundLabel)) {
                    relatedBackgrounds.push(other.backgroundLabel);
                }
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
            relatedScenes: [
                understanding.scene.sceneType,
                understanding.scene.environment,
                ...understanding.scene.preparedScenes,
            ],
            relatedCreativeStyles: [
                ...understanding.relationships.relatedCreativeStyles,
                analysis.classification.creativeStyle,
            ],
            relatedMarketingCampaigns: [
                ...analysis.relationships.relatedMarketingCampaigns,
                ...understanding.relationships.relatedMarketingCampaigns,
            ],
            relatedVisualPlans: [
                `visual-plan-${record.classification.backgroundType}`,
                `composition-${understanding.visual.visualHierarchy}`,
            ],
            relatedKnowledge: [
                ...new Set([
                    ...knowledgeIds,
                    ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
                    ...analysis.relationships.relatedKnowledge,
                    ...understanding.relationships.relatedKnowledge,
                    ...detection.relationships.relatedKnowledge,
                ]),
            ],
            relatedBackgrounds: [...new Set([...relatedBackgrounds, ...detection.relationships.relatedBackgrounds])],
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
//# sourceMappingURL=background-linker.js.map