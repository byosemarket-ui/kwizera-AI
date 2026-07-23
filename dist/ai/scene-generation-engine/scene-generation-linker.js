export class SceneGenerationLinker {
    detectRelationships(record, storyboard, input) {
        return {
            storyboards: [storyboard.storyboardId],
            products: storyboard.relationships.products.length > 0
                ? storyboard.relationships.products
                : record.profile.productId !== "unknown-product"
                    ? [record.profile.productId]
                    : [],
            brands: storyboard.relationships.brands.length > 0
                ? storyboard.relationships.brands
                : [record.profile.brandId],
            campaigns: [record.profile.campaignId, ...storyboard.relationships.campaigns],
            scripts: input.scriptId
                ? [input.scriptId, ...storyboard.relationships.scripts]
                : storyboard.relationships.scripts,
            motionPlans: [`motion-plan-${record.sceneId}`],
            cameraPlans: [`camera-plan-${record.sceneId}`],
            audioPlans: [`audio-plan-${record.sceneId}`],
            knowledgeRecords: [
                ...(input.knowledgeRecordIds ?? []),
                ...storyboard.relationships.knowledgeRecords,
            ],
            images: input.imageIds ?? storyboard.relationships.images,
            videos: input.videoIds ?? storyboard.relationships.videos,
        };
    }
}
//# sourceMappingURL=scene-generation-linker.js.map