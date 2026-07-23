import {
  DetectedScene,
  DetectedShot,
  DetectedTransition,
  SceneDetectionScores,
  TransitionType,
} from "./types.js";

export class SceneDetectionScorer {
  computeScores(
    scenes: DetectedScene[],
    shots: DetectedShot[],
    transitions: DetectedTransition[],
    timelineLengthMs: number,
    sceneCountExpected: number,
    shotCountExpected: number,
    frameConsistencyScore: number
  ): SceneDetectionScores {
    let sceneDetectionScore = 55;
    if (scenes.length >= 3) sceneDetectionScore += 15;
    if (scenes.length >= sceneCountExpected) sceneDetectionScore += 10;
    if (scenes.every((s) => s.durationMs > 0)) sceneDetectionScore += 10;
    if (scenes.every((s) => s.purpose.length >= 10)) sceneDetectionScore += 5;
    sceneDetectionScore = Math.min(100, sceneDetectionScore);

    let shotDetectionScore = 50;
    if (shots.length >= scenes.length) shotDetectionScore += 15;
    if (shots.length >= shotCountExpected * 0.5) shotDetectionScore += 10;
    if (shots.every((s) => s.shotType)) shotDetectionScore += 10;
    if (shots.filter((s) => s.cameraChange).length > 0) shotDetectionScore += 5;
    shotDetectionScore = Math.min(100, shotDetectionScore);

    let transitionScore = 50;
    if (transitions.length >= scenes.length - 1) transitionScore += 20;
    if (transitions.some((t) => t.type !== TransitionType.Cut)) transitionScore += 10;
    if (transitions.every((t) => t.fromSceneId && t.toSceneId)) transitionScore += 10;
    transitionScore = Math.min(100, transitionScore);

    let timelineAccuracyScore = 55;
    const detectedDuration = scenes.reduce((s, sc) => s + sc.durationMs, 0);
    if (timelineLengthMs > 0) {
      const coverage = detectedDuration / timelineLengthMs;
      if (coverage >= 0.95 && coverage <= 1.05) timelineAccuracyScore += 25;
      else if (coverage >= 0.85) timelineAccuracyScore += 15;
    }
    timelineAccuracyScore += Math.round(frameConsistencyScore * 0.15);
    timelineAccuracyScore = Math.min(100, timelineAccuracyScore);

    const aiConfidenceScore = Math.round(
      (sceneDetectionScore + shotDetectionScore + transitionScore + timelineAccuracyScore) / 4
    );

    return {
      sceneDetectionScore,
      shotDetectionScore,
      transitionScore,
      timelineAccuracyScore,
      aiConfidenceScore,
    };
  }

  isDetectionValid(scores: SceneDetectionScores, sceneCount: number, shotCount: number): {
    valid: boolean;
    diagnostics: string[];
  } {
    const diagnostics: string[] = [];

    if (sceneCount < 2) {
      diagnostics.push("Minimum 2 scenes required for validated scene detection");
    }
    if (shotCount < 1) {
      diagnostics.push("At least 1 shot required for validated scene detection");
    }
    if (scores.sceneDetectionScore < 55) {
      diagnostics.push(`Scene detection score ${scores.sceneDetectionScore} below threshold (55)`);
    }
    if (scores.shotDetectionScore < 50) {
      diagnostics.push(`Shot detection score ${scores.shotDetectionScore} below threshold (50)`);
    }
    if (scores.timelineAccuracyScore < 50) {
      diagnostics.push(`Timeline accuracy ${scores.timelineAccuracyScore} below threshold (50)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }
}
