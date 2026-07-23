export class MarketingVideoLinker {
    detectRelationships(record, storyboard, upstream, input) {
        return {
            products: storyboard.relationships.products.length > 0
                ? storyboard.relationships.products
                : [storyboard.profile.productId],
            brands: storyboard.relationships.brands.length > 0
                ? storyboard.relationships.brands
                : [storyboard.profile.brandId],
            campaigns: storyboard.relationships.campaigns.length > 0
                ? storyboard.relationships.campaigns
                : [storyboard.profile.campaignId],
            storyboards: [storyboard.storyboardId],
            marketingPlans: storyboard.relationships.marketingStrategies,
            audioPlans: upstream.audioPlans.map((a) => a.audioSynchronizationId),
            visualPlans: upstream.visualEffectPlans.map((v) => v.visualEffectPlanId),
            animationPlans: upstream.animationPlans.map((a) => a.animationPlanId),
            motionPlans: upstream.motionPlans.map((m) => m.motionPlanId),
            cameraPlans: upstream.cameraPlans.map((c) => c.cameraPlanId),
            scenes: upstream.scenes.map((s) => s.sceneId),
            knowledgeRecords: [
                ...(input.knowledgeRecordIds ?? []),
                ...storyboard.relationships.knowledgeRecords,
            ],
        };
    }
}
//# sourceMappingURL=marketing-video-linker.js.map