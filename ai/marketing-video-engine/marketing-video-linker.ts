import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { AudioSynchronizationRecord } from "../audio-synchronization-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import { MarketingVideoInput, MarketingVideoRecord, MarketingVideoRelationships } from "./types.js";

export interface UpstreamMarketingAssets {
  scenes: SceneGenerationRecord[];
  cameraPlans: CameraDirectorRecord[];
  motionPlans: MotionGenerationRecord[];
  animationPlans: AnimationGenerationRecord[];
  visualEffectPlans: VisualEffectsGenerationRecord[];
  audioPlans: AudioSynchronizationRecord[];
}

export class MarketingVideoLinker {
  detectRelationships(
    record: MarketingVideoRecord,
    storyboard: StoryboardGenerationRecord,
    upstream: UpstreamMarketingAssets,
    input: MarketingVideoInput
  ): MarketingVideoRelationships {
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
