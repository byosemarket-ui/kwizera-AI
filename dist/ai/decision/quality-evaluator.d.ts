import { DecisionRequest, MissingInformationItem, QualityAssessment } from "./types.js";
export declare class QualityEvaluator {
    evaluate(request: DecisionRequest, availableData: Record<string, unknown>): QualityAssessment;
    detectMissingInformation(request: DecisionRequest, availableData: Record<string, unknown>): MissingInformationItem[];
    private hasRequiredFields;
    private requiresImages;
    private hasRequiredResources;
}
//# sourceMappingURL=quality-evaluator.d.ts.map