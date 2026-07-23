import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import { VisualEffectsGenerationInput, VisualEffectsGenerationRecord, VisualEffectsGenerationRelationships } from "./types.js";
export declare class VisualEffectsGenerationLinker {
    detectRelationships(record: VisualEffectsGenerationRecord, scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord, cameraPlan: CameraDirectorRecord, animationPlan: AnimationGenerationRecord, input: VisualEffectsGenerationInput): VisualEffectsGenerationRelationships;
}
//# sourceMappingURL=visual-effects-generation-linker.d.ts.map