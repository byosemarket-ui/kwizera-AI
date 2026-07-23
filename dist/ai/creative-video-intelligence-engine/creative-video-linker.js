export class CreativeVideoLinker {
    detectRelationships(record, allRecords, analysis, sceneDetection, motion, camera, enhancement, style, projects = [], knowledgeIds = [], storyboards = [], scripts = []) {
        const relatedVideos = [];
        for (const other of allRecords) {
            if (other.videoId === record.videoId)
                continue;
            if (other.creativeType === record.creativeType)
                relatedVideos.push(other.videoId);
        }
        return {
            relatedStoryboards: [
                ...new Set([
                    ...storyboards,
                    record.profile.creativeVideoId,
                    ...record.storyboard.sceneOrder,
                ]),
            ],
            relatedProducts: [...new Set(analysis.relationships.relatedProducts)],
            relatedBrands: [...new Set(analysis.relationships.relatedBrands)],
            relatedCampaigns: [...new Set(analysis.relationships.relatedCampaigns)],
            relatedMotionPlans: motion ? [motion.intelligenceId, motion.motionPlan.motionPath] : [],
            relatedCameraPlans: camera
                ? [camera.intelligenceId, camera.movementPlan.recommendedPath]
                : [],
            relatedEnhancementPlans: enhancement
                ? [enhancement.intelligenceId, enhancement.profile.enhancementPlanId]
                : [],
            relatedScripts: [...new Set(scripts)],
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
//# sourceMappingURL=creative-video-linker.js.map