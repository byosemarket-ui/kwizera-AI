import { PlanningType } from "./types.js";
export class PlanRiskAnalyzer {
    analyze(input) {
        const risks = [];
        const failures = [];
        const recoveryOptions = [];
        const alternatives = [];
        if (!input.availableData.brandProfile) {
            risks.push("Brand consistency may be reduced without brand profile");
            recoveryOptions.push("Provide brand profile before execution");
        }
        if ((input.planningType === PlanningType.PromotionalVideoProduction ||
            input.planningType === PlanningType.ImageAnalysis) &&
            !input.availableData.images) {
            risks.push("Missing visual assets for media workflow");
            failures.push("Video or image module may fail without source assets");
            recoveryOptions.push("Upload product images before starting");
            alternatives.push("Use placeholder assets for draft preview only");
        }
        if (!input.reasoningResult?.readyForDecision) {
            risks.push("Decision proceeded without full reasoning confidence");
            alternatives.push("Re-run reasoning with additional context");
        }
        recoveryOptions.push("Retry failed task with recovery checkpoint");
        recoveryOptions.push("Rollback to last validated checkpoint");
        alternatives.push("Execute reduced-scope minimal workflow");
        let successRate = 85;
        successRate -= risks.length * 8;
        successRate -= failures.length * 12;
        if (input.reasoningResult?.confidence.score) {
            successRate = Math.round((successRate + input.reasoningResult.confidence.score) / 2);
        }
        successRate = Math.max(20, Math.min(98, successRate));
        return {
            possibleRisks: risks.length > 0 ? risks : ["No significant risks identified"],
            possibleFailures: failures.length > 0 ? failures : ["Standard module slot dependencies"],
            recoveryOptions,
            alternativeStrategies: alternatives,
            expectedSuccessRate: successRate,
        };
    }
}
//# sourceMappingURL=plan-risk-analyzer.js.map