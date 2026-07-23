export class MotionGenerationLinker {
    detectRelationships(record, scene, cameraPlan, input) {
        return {
            storyboards: [scene.profile.storyboardId],
            scenes: [scene.sceneId],
            cameraPlans: [cameraPlan.cameraPlanId],
            stylePlans: input.stylePlanId ? [input.stylePlanId] : [],
            products: scene.relationships.products.length > 0 ? scene.relationships.products : [scene.profile.productId],
            brands: scene.relationships.brands.length > 0 ? scene.relationships.brands : [scene.profile.brandId],
            campaigns: scene.relationships.campaigns,
            knowledgeRecords: [
                ...(input.knowledgeRecordIds ?? []),
                ...scene.relationships.knowledgeRecords,
            ],
        };
    }
}
//# sourceMappingURL=motion-generation-linker.js.map