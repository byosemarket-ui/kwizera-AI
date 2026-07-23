export class RiskEvaluator {
    evaluate(request, approaches) {
        const risks = [];
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
        const overallRisk = risks.some((r) => r.severity === "high")
            ? "high"
            : risks.length > 0
                ? "medium"
                : "low";
        return { overallRisk, risks };
    }
}
//# sourceMappingURL=risk-evaluator.js.map