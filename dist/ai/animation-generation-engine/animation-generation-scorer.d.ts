import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { AnimationGenerationRecordDraft } from "./animation-generation-analyzer.js";
import { AnimationGenerationScores } from "./types.js";
export declare class AnimationGenerationScorer {
    computeScores(draft: AnimationGenerationRecordDraft, scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord, cameraPlan: CameraDirectorRecord): AnimationGenerationScores;
    isPlanValid(scores: AnimationGenerationScores, draft: AnimationGenerationRecordDraft): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: AnimationGenerationScores, draft: AnimationGenerationRecordDraft): boolean;
    isBrandConsistent(scene: SceneGenerationRecord): boolean;
    isSmooth(scores: AnimationGenerationScores, draft: AnimationGenerationRecordDraft): boolean;
    private computeQuality;
    private computeSmoothness;
    private computeVisualAppeal;
    private computeSync;
    private computeProductionReadiness;
}
//# sourceMappingURL=animation-generation-scorer.d.ts.map