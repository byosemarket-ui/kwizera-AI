export class MotionIntelligenceLinker {
    detectRelationships(record, allRecords, analysis, sceneDetection, timeline, camera, projects = [], knowledgeIds = [], storyboards = []) {
        const relatedVideos = [];
        for (const other of allRecords) {
            if (other.videoId === record.videoId)
                continue;
            if (other.dominantClassification === record.dominantClassification) {
                relatedVideos.push(other.videoId);
            }
        }
        const cameraMovements = [];
        if (camera) {
            cameraMovements.push(camera.intelligenceId, ...camera.detectedMovements);
        }
        return {
            relatedScenes: sceneDetection.scenes.map((s) => s.sceneId),
            relatedShots: sceneDetection.shots.map((s) => s.shotId),
            relatedCameraMovements: cameraMovements,
            relatedTimelines: timeline
                ? [timeline.timelineId, ...timeline.variants.map((v) => v.timelineId)]
                : [],
            relatedStoryboards: [...new Set(storyboards)],
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
//# sourceMappingURL=motion-intelligence-linker.js.map