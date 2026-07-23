import { VideoQualityCategoryScores, VideoQualityChecks, VideoQualityRiskItem, VideoQualityRiskSeverity } from "./types.js";
import type { UpstreamVideoQualityContext } from "./video-quality-prediction-analyzer.js";
export declare class VideoQualityPredictionScorer {
    computeScores(ctx: UpstreamVideoQualityContext, checks: VideoQualityChecks): VideoQualityCategoryScores;
    isPredictionValid(scores: VideoQualityCategoryScores, risks: VideoQualityRiskItem[], checks: VideoQualityChecks): {
        valid: boolean;
        diagnostics: string[];
    };
    severityRank(severity: VideoQualityRiskSeverity): number;
}
//# sourceMappingURL=video-quality-prediction-scorer.d.ts.map