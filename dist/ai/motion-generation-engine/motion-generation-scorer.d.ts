import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import { MotionGenerationRecordDraft, MotionGenerationScores } from "./types.js";
export declare class MotionGenerationScorer {
    computeScores(draft: MotionGenerationRecordDraft, scene: SceneGenerationRecord, cameraPlan: CameraDirectorRecord): MotionGenerationScores;
    isPlanValid(scores: MotionGenerationScores, draft: MotionGenerationRecordDraft): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: MotionGenerationScores, draft: MotionGenerationRecordDraft): boolean;
    isPhysicallyConsistent(scores: MotionGenerationScores, draft: MotionGenerationRecordDraft): boolean;
    isCinematicallyConsistent(draft: MotionGenerationRecordDraft): boolean;
    private computeMotionQuality;
    private computeSmoothness;
    private computeCinematic;
    private computePhysics;
    private computeProductionReadiness;
}
//# sourceMappingURL=motion-generation-scorer.d.ts.map