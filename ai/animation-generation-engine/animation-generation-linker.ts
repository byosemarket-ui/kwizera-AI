import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import { AnimationGenerationInput, AnimationGenerationRecord, AnimationGenerationRelationships } from "./types.js";

export class AnimationGenerationLinker {
  detectRelationships(
    record: AnimationGenerationRecord,
    scene: SceneGenerationRecord,
    motionPlan: MotionGenerationRecord,
    cameraPlan: CameraDirectorRecord,
    input: AnimationGenerationInput
  ): AnimationGenerationRelationships {
    return {
      storyboards: [scene.profile.storyboardId],
      scenes: [scene.sceneId],
      motionPlans: [motionPlan.motionPlanId],
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
