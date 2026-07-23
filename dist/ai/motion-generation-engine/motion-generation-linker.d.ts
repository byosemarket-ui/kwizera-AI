import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import { MotionGenerationInput, MotionGenerationRecord, MotionGenerationRelationships } from "./types.js";
export declare class MotionGenerationLinker {
    detectRelationships(record: MotionGenerationRecord, scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord, input: MotionGenerationInput): MotionGenerationRelationships;
}
//# sourceMappingURL=motion-generation-linker.d.ts.map