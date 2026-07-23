import { DetectedScene, DetectedShot, DetectedTransition, SceneDetectionScores } from "./types.js";
export declare class SceneDetectionScorer {
    computeScores(scenes: DetectedScene[], shots: DetectedShot[], transitions: DetectedTransition[], timelineLengthMs: number, sceneCountExpected: number, shotCountExpected: number, frameConsistencyScore: number): SceneDetectionScores;
    isDetectionValid(scores: SceneDetectionScores, sceneCount: number, shotCount: number): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=scene-detection-scorer.d.ts.map