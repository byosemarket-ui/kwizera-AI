import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { VideoProductionRecord } from "../video-production-engine/types.js";
import { RenderingUpstreamAssets } from "./rendering-preparation-analyzer.js";
import { RenderingPreparationInput, RenderingPreparationRecord, RenderingPreparationRelationships } from "./types.js";

export class RenderingPreparationLinker {
  detectRelationships(
    record: RenderingPreparationRecord,
    storyboard: StoryboardGenerationRecord,
    upstream: RenderingUpstreamAssets,
    input: RenderingPreparationInput
  ): RenderingPreparationRelationships {
    return {
      storyboards: [storyboard.storyboardId],
      productionPlans: [upstream.productionPlan.productionId],
      renderPlans: [record.renderPlanId],
      products: storyboard.relationships.products.length > 0
        ? storyboard.relationships.products
        : [storyboard.profile.productId],
      brands: storyboard.relationships.brands.length > 0
        ? storyboard.relationships.brands
        : [storyboard.profile.brandId],
      campaigns: storyboard.relationships.campaigns.length > 0
        ? storyboard.relationships.campaigns
        : [storyboard.profile.campaignId],
      motionPlans: upstream.motionPlans.map((m) => m.motionPlanId),
      cameraPlans: upstream.cameraPlans.map((c) => c.cameraPlanId),
      animationPlans: upstream.animationPlans.map((a) => a.animationPlanId),
      visualEffectPlans: upstream.visualEffectPlans.map((v) => v.visualEffectPlanId),
      audioPlans: upstream.audioPlans.map((a) => a.audioSynchronizationId),
      marketingPlans: [upstream.marketingPlan.marketingVideoId],
      knowledgeRecords: [
        ...(input.knowledgeRecordIds ?? []),
        ...storyboard.relationships.knowledgeRecords,
      ],
      scenes: upstream.scenes.map((s) => s.sceneId),
    };
  }
}
