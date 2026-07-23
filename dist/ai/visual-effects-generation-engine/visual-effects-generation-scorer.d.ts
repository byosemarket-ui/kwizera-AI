import type { AnimationGenerationRecord } from "../animation-generation-engine/types.js";
import type { CameraDirectorRecord } from "../camera-director-engine/types.js";
import type { MotionGenerationRecord } from "../motion-generation-engine/types.js";
import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import type { VisualEffectsGenerationRecordDraft } from "./visual-effects-generation-analyzer.js";
import { VisualEffectsGenerationScores } from "./types.js";
export declare class VisualEffectsGenerationScorer {
    computeScores(draft: VisualEffectsGenerationRecordDraft, scene: SceneGenerationRecord, motionPlan: MotionGenerationRecord, cameraPlan: CameraDirectorRecord, animationPlan: AnimationGenerationRecord): VisualEffectsGenerationScores;
    isPlanValid(scores: VisualEffectsGenerationScores, draft: VisualEffectsGenerationRecordDraft): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: VisualEffectsGenerationScores, draft: VisualEffectsGenerationRecordDraft): boolean;
    isBrandConsistent(scene: SceneGenerationRecord): boolean;
    isCinematicallyConsistent(scores: VisualEffectsGenerationScores, draft: VisualEffectsGenerationRecordDraft): boolean;
    private computeVisualEffects;
    private computeCinematic;
    private computeSync;
    private computeBrandConsistency;
    private computeProductionReadiness;
}
//# sourceMappingURL=visual-effects-generation-scorer.d.ts.map