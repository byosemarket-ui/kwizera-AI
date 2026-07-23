import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import { AudioSynchronizationInput, AudioSynchronizationRecord, AudioSynchronizationRelationships } from "./types.js";

export class AudioSynchronizationLinker {
  detectRelationships(
    record: AudioSynchronizationRecord,
    scene: SceneGenerationRecord,
    motionPlan: MotionGenerationRecord,
    cameraPlan: CameraDirectorRecord,
    animationPlan: AnimationGenerationRecord,
    vfxPlan: VisualEffectsGenerationRecord,
    input: AudioSynchronizationInput
  ): AudioSynchronizationRelationships {
    return {
      storyboards: [scene.profile.storyboardId],
      scenes: [scene.sceneId],
      cameraPlans: [cameraPlan.cameraPlanId],
      motionPlans: [motionPlan.motionPlanId],
      animationPlans: [animationPlan.animationPlanId],
      visualEffectPlans: [vfxPlan.visualEffectPlanId],
      stylePlans: input.stylePlanId ? [input.stylePlanId] : [],
      products: scene.relationships.products.length > 0 ? scene.relationships.products : [scene.profile.productId],
      brands: scene.relationships.brands.length > 0 ? scene.relationships.brands : [scene.profile.brandId],
      campaigns: scene.relationships.campaigns,
      knowledgeRecords: [
        ...(input.knowledgeRecordIds ?? []),
        ...scene.relationships.knowledgeRecords,
      ],
      voiceFiles: input.voiceFileIds ?? [],
      musicTracks: input.musicIds ?? [],
      soundEffects: input.soundEffectIds ?? [],
      scripts: input.scriptId ? [input.scriptId, ...scene.relationships.scripts] : scene.relationships.scripts,
    };
  }
}
