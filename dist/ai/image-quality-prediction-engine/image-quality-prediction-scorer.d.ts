import { ImageQualityCategoryScores, ImageQualityChecks, ImageQualityRiskItem, ImageQualityRiskSeverity } from "./types.js";
import type { UpstreamQualityContext } from "./image-quality-prediction-analyzer.js";
export declare class ImageQualityPredictionScorer {
    computeScores(ctx: UpstreamQualityContext, checks: ImageQualityChecks): ImageQualityCategoryScores;
    isPredictionValid(scores: ImageQualityCategoryScores, risks: ImageQualityRiskItem[], checks: ImageQualityChecks): {
        valid: boolean;
        diagnostics: string[];
    };
    severityRank(severity: ImageQualityRiskSeverity): number;
}
//# sourceMappingURL=image-quality-prediction-scorer.d.ts.map