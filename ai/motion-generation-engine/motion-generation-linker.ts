import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import { MotionGenerationInput, MotionGenerationRecord, MotionGenerationRelationships } from "./types.js";

export class MotionGenerationLinker {
  detectRelationships(
    record: MotionGenerationRecord,
    scene: SceneGenerationRecord,
    cameraPlan: CameraDirectorRecord,
    input: MotionGenerationInput
  ): MotionGenerationRelationships {
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
