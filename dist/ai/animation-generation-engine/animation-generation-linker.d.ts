import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import { AnimationGenerationInput, AnimationGenerationRecord, AnimationGenerationRelationships } from "./types.js";
export declare class AnimationGenerationLinker {
    detectRelationships(record: AnimationGenerationRecord, scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord, cameraPlan: CameraDirectorRecord, input: AnimationGenerationInput): AnimationGenerationRelationships;
}
//# sourceMappingURL=animation-generation-linker.d.ts.map