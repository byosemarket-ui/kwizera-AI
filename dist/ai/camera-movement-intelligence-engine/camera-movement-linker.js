export class CameraMovementLinker {
    detectRelationships(record, allRecords, analysis, sceneDetection, timeline, projects = [], knowledgeIds = [], storyboards = [], scripts = []) {
        const relatedVideos = [];
        for (const other of allRecords) {
            if (other.videoId === record.videoId)
                continue;
            if (other.dominantMovement === record.dominantMovement)
                relatedVideos.push(other.videoId);
        }
        return {
            relatedScenes: sceneDetection.scenes.map((s) => s.sceneId),
            relatedShots: sceneDetection.shots.map((s) => s.shotId),
            relatedTimelines: timeline ? [timeline.timelineId, ...timeline.variants.map((v) => v.timelineId)] : [],
            relatedStoryboards: [...new Set(storyboards)],
            relatedScripts: [...new Set(scripts)],
            relatedProducts: [...new Set(analysis.relationships.relatedProducts)],
            relatedBrands: [...new Set(analysis.relationships.relatedBrands)],
            relatedCampaigns: [...new Set(analysis.relationships.relatedCampaigns)],
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
//# sourceMappingURL=camera-movement-linker.js.map