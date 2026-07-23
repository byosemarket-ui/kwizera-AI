import { CameraQualityScores, CameraStabilityLevel, ShotCameraAnalysis, ShotFraming } from "./types.js";

export class CameraMovementScorer {
  computeScores(
    shots: ShotCameraAnalysis[],
    avgContinuity: number,
    productionReadinessFromTimeline: number,
    storytellingScore: number
  ): CameraQualityScores {
    let cameraMovementScore = 55;
    if (shots.length >= 3) cameraMovementScore += 15;
    const uniqueMovements = new Set(shots.map((s) => s.movement)).size;
    if (uniqueMovements >= 2) cameraMovementScore += 10;
    if (shots.every((s) => s.confidence >= 70)) cameraMovementScore += 10;
    cameraMovementScore = Math.min(100, cameraMovementScore);

    let cinematicScore = 60;
    if (uniqueMovements >= 3) cinematicScore += 15;
    if (shots.some((s) => s.framing === ShotFraming.HeroShot || s.framing === ShotFraming.CloseUp)) cinematicScore += 10;
    cinematicScore = Math.min(100, cinematicScore);

    const stableWeight = shots.filter((s) => s.stability === CameraStabilityLevel.Stable).length;
    const slightWeight =
      shots.filter((s) => s.stability === CameraStabilityLevel.SlightShake).length * 0.75;
    let stabilityScore =
      shots.length > 0
        ? Math.round(((stableWeight + slightWeight) / shots.length) * 100)
        : 50;
    const avgSmoothness =
      shots.length > 0
        ? Math.round(shots.reduce((s, sh) => s + sh.motionSmoothness, 0) / shots.length)
        : 50;
    stabilityScore = Math.round((stabilityScore + avgSmoothness) / 2);

    const productionReadinessScore = Math.round(
      (productionReadinessFromTimeline + stabilityScore + avgContinuity) / 3
    );

    const aiConfidenceScore = Math.round(
      (cameraMovementScore + cinematicScore + stabilityScore + storytellingScore + productionReadinessScore) / 5
    );

    return {
      cameraMovementScore,
      cinematicScore,
      stabilityScore,
      storytellingScore,
      productionReadinessScore,
      aiConfidenceScore: Math.min(100, aiConfidenceScore),
    };
  }

  isAnalysisValid(scores: CameraQualityScores, shotCount: number): {
    valid: boolean;
    diagnostics: string[];
  } {
    const diagnostics: string[] = [];
    if (shotCount < 1) diagnostics.push("At least 1 shot required for camera analysis");
    if (scores.cameraMovementScore < 55) {
      diagnostics.push(`Camera movement score ${scores.cameraMovementScore} below threshold (55)`);
    }
    if (scores.stabilityScore < 45) {
      diagnostics.push(`Stability score ${scores.stabilityScore} below threshold (45)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence ${scores.aiConfidenceScore} below threshold (55)`);
    }
    return { valid: diagnostics.length === 0, diagnostics };
  }
}
