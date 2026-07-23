import { ConfidenceAssessment, ConfidenceLevel, ContextAnalysis, MissingInformationItem, ReasoningApproach } from "./types.js";
export declare class ConfidenceCalculator {
    calculate(context: ContextAnalysis, approaches: ReasoningApproach[], missing: MissingInformationItem[]): ConfidenceAssessment;
    scoreToLevel(score: number): ConfidenceLevel;
}
//# sourceMappingURL=confidence-calculator.d.ts.map