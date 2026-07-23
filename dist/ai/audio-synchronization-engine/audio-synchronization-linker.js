export class AudioSynchronizationLinker {
    detectRelationships(record, scene, motionPlan, cameraPlan, animationPlan, vfxPlan, input) {
        return {
            storyboards: [scene.profile.storyboardId],
            scenes: [scene.sceneId],
            cameraPlans: [cameraPlan.cameraPlanId],
            motionPlans: [motionPlan.motionPlanId],
            animationPlans: [animationPlan.animationPlanId],
            visualEffectPlans: [vfxPlan.visualEffectPlanId],
            stylePlans: input.stylePlanId ? [input.stylePlanId] : [],
            products: scene.relationships.products.length > 0 ? scene.relationships.products : [scene.profile.productId],
            brands: scene.relationships.brands.length > 0 ? scene.relationships.brands : [scene.profile.brandId],
            campaigns: scene.relationships.campaigns,
            knowledgeRecords: [
                ...(input.knowledgeRecordIds ?? []),
                ...scene.relationships.knowledgeRecords,
            ],
            voiceFiles: input.voiceFileIds ?? [],
            musicTracks: input.musicIds ?? [],
            soundEffects: input.soundEffectIds ?? [],
            scripts: input.scriptId ? [input.scriptId, ...scene.relationships.scripts] : scene.relationships.scripts,
        };
    }
}
//# sourceMappingURL=audio-synchronization-linker.js.map