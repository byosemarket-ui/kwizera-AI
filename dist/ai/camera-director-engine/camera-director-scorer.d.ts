import type { SceneGenerationRecord } from "../scene-generation-engine/types.js";
import { CameraDirectorRecordDraft, CameraDirectorScores, ContinuityPlanning } from "./types.js";
export declare class CameraDirectorScorer {
    computeScores(draft: CameraDirectorRecordDraft, scene: SceneGenerationRecord): CameraDirectorScores;
    isPlanValid(scores: CameraDirectorScores, draft: Pick<CameraDirectorRecordDraft, "shotPlans" | "continuity" | "focusPlanning" | "compositionPlanning">): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: CameraDirectorScores, draft: Pick<CameraDirectorRecordDraft, "shotPlans" | "platformOptimizations">): boolean;
    isBrandConsistent(scores: CameraDirectorScores, scene: SceneGenerationRecord): boolean;
    isCinematicallyConsistent(continuity: ContinuityPlanning): boolean;
    private computeDirectionScore;
    private computeCinematicScore;
    private computeCompositionScore;
    private computeStorytellingScore;
    private computeProductionReadiness;
}
//# sourceMappingURL=camera-director-scorer.d.ts.map