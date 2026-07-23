import { CameraQualityScores, ShotCameraAnalysis } from "./types.js";
export declare class CameraMovementScorer {
    computeScores(shots: ShotCameraAnalysis[], avgContinuity: number, productionReadinessFromTimeline: number, storytellingScore: number): CameraQualityScores;
    isAnalysisValid(scores: CameraQualityScores, shotCount: number): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=camera-movement-scorer.d.ts.map