import {
  QualityChecks,
  QualityPredictionRecord,
  QualityScores,
  RiskItem,
} from "./types.js";

export class QualityPredictionScorer {
  isPredictionValid(
    scores: QualityScores,
    checks: QualityChecks,
    risks: RiskItem[],
    productionPlanReady: boolean
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    const criticalUnresolved = risks.filter((r) => r.severity === "critical" && !r.resolved);
    if (criticalUnresolved.length > 0) {
      diagnostics.push(`Unresolved critical risks: ${criticalUnresolved.map((r) => r.category).join(", ")}`);
    }

    if (checks.issues.length > 0) diagnostics.push(...checks.issues);
    if (!productionPlanReady) diagnostics.push("Production plan must be production-ready");
    if (scores.overallQualityScore < 55) {
      diagnostics.push(`Overall quality score ${scores.overallQualityScore} below threshold (55)`);
    }
    if (scores.productionReadinessScore < 55) {
      diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(
    scores: QualityScores,
    risks: RiskItem[],
    productionPlanReady: boolean,
    checks: QualityChecks
  ): boolean {
    const noCritical = !risks.some((r) => r.severity === "critical" && !r.resolved);
    return (
      productionPlanReady &&
      noCritical &&
      checks.dependencyValidation &&
      scores.overallQualityScore >= 55 &&
      scores.productionReadinessScore >= 55
    );
  }
}
