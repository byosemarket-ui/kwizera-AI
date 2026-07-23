import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import { VisualEffectsGenerationInput, VisualEffectsGenerationRecord, VisualEffectsGenerationRelationships } from "./types.js";

export class VisualEffectsGenerationLinker {
  detectRelationships(
    record: VisualEffectsGenerationRecord,
    scene: SceneGenerationRecord,
    motionPlan: MotionGenerationRecord,
    cameraPlan: CameraDirectorRecord,
    animationPlan: AnimationGenerationRecord,
    input: VisualEffectsGenerationInput
  ): VisualEffectsGenerationRelationships {
    return {
      storyboards: [scene.profile.storyboardId],
      scenes: [scene.sceneId],
      cameraPlans: [cameraPlan.cameraPlanId],
      motionPlans: [motionPlan.motionPlanId],
      animationPlans: [animationPlan.animationPlanId],
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
