export class VideoStyleLinker {
    detectRelationships(record, allRecords, analysis, timeline, camera, motion, projects = [], knowledgeIds = [], storyboards = [], creativePlans = []) {
        const relatedVideos = [];
        for (const other of allRecords) {
            if (other.videoId === record.videoId)
                continue;
            if (other.dominantCinematicStyle === record.dominantCinematicStyle) {
                relatedVideos.push(other.videoId);
            }
        }
        return {
            relatedBrands: [...new Set(analysis.relationships.relatedBrands)],
            relatedProducts: [...new Set(analysis.relationships.relatedProducts)],
            relatedCampaigns: [...new Set(analysis.relationships.relatedCampaigns)],
            relatedStoryboards: [...new Set(storyboards)],
            relatedCreativePlans: [...new Set(creativePlans)],
            relatedMotionPlans: motion ? [motion.intelligenceId, motion.motionPlan.motionPath] : [],
            relatedCameraPlans: camera
                ? [camera.intelligenceId, camera.movementPlan.recommendedPath]
                : [],
            relatedTimelines: timeline
                ? [timeline.timelineId, ...timeline.variants.map((v) => v.timelineId)]
                : [],
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
//# sourceMappingURL=video-style-linker.js.map