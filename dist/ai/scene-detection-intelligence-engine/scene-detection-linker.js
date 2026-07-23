export class SceneDetectionLinker {
    detectRelationships(record, allRecords, analysis, projects = [], knowledgeIds = [], storyboards = [], scripts = []) {
        const relatedVideos = [];
        for (const other of allRecords) {
            if (other.videoId === record.videoId)
                continue;
            const sharedBrand = other.relationships.relatedBrands.some((b) => record.relationships.relatedBrands.includes(b));
            const sharedProduct = other.relationships.relatedProducts.some((p) => record.relationships.relatedProducts.includes(p));
            if (sharedBrand || sharedProduct) {
                relatedVideos.push(other.videoId);
            }
        }
        return {
            relatedProducts: [...new Set(analysis.relationships.relatedProducts)],
            relatedBrands: [...new Set(analysis.relationships.relatedBrands)],
            relatedCampaigns: [...new Set(analysis.relationships.relatedCampaigns)],
            relatedStoryboards: [...new Set([...storyboards, ...record.sceneRelationships.flatMap((r) => r.relatedStoryboards)])],
            relatedScripts: [...new Set([...scripts, ...record.sceneRelationships.flatMap((r) => r.relatedScripts)])],
            relatedKnowledge: [
                ...new Set([
                    ...knowledgeIds,
                    ...(analysis.knowledgeId ? [analysis.knowledgeId] : []),
                    ...analysis.relationships.relatedKnowledge,
                ]),
            ],
            relatedVideos: [...new Set([...relatedVideos, ...analysis.relationships.relatedVideos])].slice(0, 10),
            relatedMemory: [...new Set(analysis.relationships.relatedMemory)],
            relatedProjects: [...new Set([...projects, ...analysis.relationships.relatedProjects])],
        };
    }
}
//# sourceMappingURL=scene-detection-linker.js.map