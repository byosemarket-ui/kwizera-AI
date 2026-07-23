import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import { CameraDirectorInput, CameraDirectorRecord, CameraDirectorRelationships } from "./types.js";

export class CameraDirectorLinker {
  detectRelationships(
    record: CameraDirectorRecord,
    scene: SceneGenerationRecord,
    storyboard: StoryboardGenerationRecord | null,
    input: CameraDirectorInput
  ): CameraDirectorRelationships {
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
