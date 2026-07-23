export class CameraDirectorLinker {
    detectRelationships(record, scene, storyboard, input) {
        return {
            storyboards: [scene.profile.storyboardId],
            scenes: [scene.sceneId],
            motionPlans: input.motionPlanId
                ? [input.motionPlanId, ...scene.relationships.motionPlans]
                : scene.relationships.motionPlans,
            stylePlans: input.stylePlanId ? [input.stylePlanId] : [],
            products: scene.relationships.products.length > 0 ? scene.relationships.products : [scene.profile.productId],
            brands: scene.relationships.brands.length > 0 ? scene.relationships.brands : [scene.profile.brandId],
            campaigns: scene.relationships.campaigns,
            knowledgeRecords: [
                ...(input.knowledgeRecordIds ?? []),
                ...scene.relationships.knowledgeRecords,
                ...(storyboard?.relationships.knowledgeRecords ?? []),
            ],
        };
    }
}
//# sourceMappingURL=camera-director-linker.js.map