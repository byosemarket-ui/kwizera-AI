import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { VisualEffectsGenerationRecord } from "../visual-effects-generation-engine/types.js";
import { AudioSynchronizationInput, AudioSynchronizationRecord, AudioSynchronizationRelationships } from "./types.js";
export declare class AudioSynchronizationLinker {
    detectRelationships(record: AudioSynchronizationRecord, scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord, cameraPlan: CameraDirectorRecord, animationPlan: AnimationGenerationRecord, vfxPlan: VisualEffectsGenerationRecord, input: AudioSynchronizationInput): AudioSynchronizationRelationships;
}
//# sourceMappingURL=audio-synchronization-linker.d.ts.map