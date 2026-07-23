import { EnhancementQualityScores, VideoQualityAnalysis } from "./types.js";
export declare class VideoEnhancementScorer {
    computeScores(quality: VideoQualityAnalysis, recommendationCount: number, platformRuleCount: number, productionBase: number, styleConsistency: number): EnhancementQualityScores;
    isPlanValid(scores: EnhancementQualityScores, recommendationCount: number, platformCount: number, nonDestructiveValid: boolean): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=video-enhancement-scorer.d.ts.map