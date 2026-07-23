import {
  ConfidenceAssessment,
  ConfidenceLevel,
  ContextAnalysis,
  MissingInformationItem,
  ReasoningApproach,
} from "./types.js";

const MIN_CONFIDENCE_SCORE = 45;

export class ConfidenceCalculator {
  calculate(
    context: ContextAnalysis,
    approaches: ReasoningApproach[],
    missing: MissingInformationItem[]
  ): ConfidenceAssessment {
    let score = context.completenessScore;

    const criticalMissing = missing.filter((m) => m.severity === "critical");
    score -= criticalMissing.length * 25;
    score -= missing.filter((m) => m.severity === "important").length * 8;

    if (context.systemHealthy) score += 10;
    if (context.brandIdentity) score += 5;
    if (context.previousLearning) score += 5;

    const bestApproach = approaches[0];
    if (bestApproach) {
      score += Math.max(0, 30 - bestApproach.estimatedRisk) / 3;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    const level = this.scoreToLevel(score);
    const sufficient = score >= MIN_CONFIDENCE_SCORE && criticalMissing.length === 0;

    const factors = [
      `completeness:${context.completenessScore}`,
      `missing-critical:${criticalMissing.length}`,
      `system:${context.systemHealthy ? "healthy" : "degraded"}`,
    ];

    const explanation = sufficient
      ? `Confidence ${level} (${score}/100) — sufficient to recommend proceeding`
      : `Confidence ${level} (${score}/100) — collect more information before continuing`;

    return { level, score, sufficient, factors, explanation };
  }

  scoreToLevel(score: number): ConfidenceLevel {
    if (score >= 90) return ConfidenceLevel.VeryHigh;
    if (score >= 75) return ConfidenceLevel.High;
    if (score >= 55) return ConfidenceLevel.Medium;
    if (score >= 35) return ConfidenceLevel.Low;
    return ConfidenceLevel.VeryLow;
  }
}
