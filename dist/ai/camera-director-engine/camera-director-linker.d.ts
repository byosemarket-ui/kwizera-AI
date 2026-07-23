import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { StoryboardGenerationRecord } from "../story-generation-engine/types.js";
import { CameraDirectorInput, CameraDirectorRecord, CameraDirectorRelationships } from "./types.js";
export declare class CameraDirectorLinker {
    detectRelationships(record: CameraDirectorRecord, scene: SceneGenerationRecord, storyboard: StoryboardGenerationRecord | null, input: CameraDirectorInput): CameraDirectorRelationships;
}
//# sourceMappingURL=camera-director-linker.d.ts.map