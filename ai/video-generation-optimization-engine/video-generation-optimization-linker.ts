import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { OptimizationUpstreamAssets } from "./video-generation-optimization-analyzer.js";
import {
  OptimizationRelationships,
  VideoGenerationOptimizationInput,
  VideoGenerationOptimizationRecord,
} from "./types.js";

export class VideoGenerationOptimizationLinker {
  detectRelationships(
    record: VideoGenerationOptimizationRecord,
    storyboard: StoryboardGenerationRecord,
    upstream: OptimizationUpstreamAssets,
    input: VideoGenerationOptimizationInput
  ): OptimizationRelationships {
    return {
      storyboards: [storyboard.storyboardId],
      productionPlans: [upstream.productionPlan.productionId],
      renderPlans: [upstream.renderPlan.renderPlanId],
      validationReports: [upstream.validationReport.validationId],
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
