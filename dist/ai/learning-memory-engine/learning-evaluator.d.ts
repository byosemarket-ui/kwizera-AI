import { LearningEventInput } from "./types.js";
export interface EvaluationResult {
    approved: boolean;
    confidenceScore: number;
    learningValue: number;
    reason?: string;
    verified: boolean;
}
export declare class LearningEvaluator {
    evaluate(input: LearningEventInput): EvaluationResult;
    private estimateQuality;
    private computeLearningValue;
}
//# sourceMappingURL=learning-evaluator.d.ts.map