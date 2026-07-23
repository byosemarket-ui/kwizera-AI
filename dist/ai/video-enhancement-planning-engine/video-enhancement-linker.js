export class VideoEnhancementLinker {
    detectRelationships(record, allRecords, analysis, sceneDetection, timeline, camera, motion, style, projects = [], knowledgeIds = []) {
        const relatedVideos = [];
        for (const other of allRecords) {
            if (other.videoId === record.videoId)
                continue;
            if (other.profile.platform === record.profile.platform)
                relatedVideos.push(other.videoId);
        }
        return {
            relatedVideos: [...new Set([...relatedVideos, ...analysis.relationships.relatedVideos])].slice(0, 10),
            relatedScenes: sceneDetection.scenes.map((s) => s.sceneId),
            relatedTimelines: timeline
                ? [timeline.timelineId, ...timeline.variants.map((v) => v.timelineId)]
                : [],
            relatedMotionPlans: motion ? [motion.intelligenceId, motion.motionPlan.motionPath] : [],
            relatedCameraPlans: camera
                ? [camera.intelligenceId, camera.movementPlan.recommendedPath]
                : [],
            relatedStylePlans: style ? [style.intelligenceId, style.profile.styleId] : [],
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
            relatedMemory: [...new Set(analysis.relationships.relatedMemory)],
            relatedProjects: [...new Set([...projects, ...analysis.relationships.relatedProjects])],
        };
    }
}
//# sourceMappingURL=video-enhancement-linker.js.map