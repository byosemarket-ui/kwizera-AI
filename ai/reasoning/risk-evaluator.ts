import { ReasoningApproach, ReasoningRequest, RiskAssessment } from "./types.js";

export class RiskEvaluator {
  evaluate(request: ReasoningRequest, approaches: ReasoningApproach[]): RiskAssessment {
    const risks: RiskAssessment["risks"] = [];

    if (!request.inputs.brandProfile) {
      risks.push({
        name: "brand-consistency",
        severity: "medium",
        mitigation: "Provide brand profile before execution",
      });
    }

    if (request.type === "video-planning" && !request.inputs.images) {
      risks.push({
        name: "missing-visual-assets",
        severity: "high",
        mitigation: "Upload product images before video planning",
      });
    }

    const highestRisk = Math.max(...approaches.map((a) => a.estimatedRisk), 0);
    if (highestRisk >= 35) {
      risks.push({
        name: "approach-complexity",
        severity: "medium",
        mitigation: "Prefer incremental validation approach",
      });
    }

    const overallRisk: RiskAssessment["overallRisk"] =
      risks.some((r) => r.severity === "high")
        ? "high"
        : risks.length > 0
          ? "medium"
          : "low";

    return { overallRisk, risks };
  }
}
