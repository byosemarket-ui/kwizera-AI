export class EnhancementPlanningLinker {
    detectRelationships(record, allRecords, analysis, understanding, background, composition, lightingColor, projects = [], knowledgeIds = []) {
        const relatedImages = [];
        for (const other of allRecords) {
            if (other.imageId === record.imageId)
                continue;
            if (other.profile.brand === record.profile.brand ||
                other.profile.product === record.profile.product) {
                relatedImages.push(other.imageId);
            }
        }
        return {
            relatedImages: [...new Set([...relatedImages, ...analysis.relationships.relatedImages])].slice(0, 10),
            relatedProducts: [
                ...new Set([record.profile.product, ...analysis.content.products, ...analysis.relationships.relatedProducts]),
            ].filter((p) => p && p !== "unspecified-product"),
            relatedBrands: [
                ...new Set([record.profile.brand, ...analysis.relationships.relatedBrands, ...understanding.relationships.relatedBrands]),
            ].filter((b) => b && b !== "unknown-brand"),
            relatedBackgroundIntelligence: background ? [background.backgroundId] : [],
            relatedCompositionIntelligence: composition ? [composition.compositionId] : [],
            relatedLightingIntelligence: lightingColor ? [lightingColor.lightingColorId] : [],
            relatedCreativeStyles: [
                analysis.classification.creativeStyle,
                ...understanding.relationships.relatedCreativeStyles,
            ],
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
//# sourceMappingURL=enhancement-planning-linker.js.map