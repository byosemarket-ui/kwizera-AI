import { QualityChecks, QualityScores, RiskItem } from "./types.js";
export declare class QualityPredictionScorer {
    isPredictionValid(scores: QualityScores, checks: QualityChecks, risks: RiskItem[], productionPlanReady: boolean): {
        valid: boolean;
        diagnostics: string[];
    };
    isProductionReady(scores: QualityScores, risks: RiskItem[], productionPlanReady: boolean, checks: QualityChecks): boolean;
}
//# sourceMappingURL=quality-prediction-scorer.d.ts.map