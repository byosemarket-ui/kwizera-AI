import { ImageEnhancementPlanningScores, ImageQualityAnalysis } from "./types.js";
export declare class EnhancementPlanningScorer {
    computeScores(quality: ImageQualityAnalysis, platformReadiness: number, hasRestorationNeed: boolean): ImageEnhancementPlanningScores;
    computePlatformReadiness(quality: ImageQualityAnalysis, platform: string): number;
    isPlanValid(scores: ImageEnhancementPlanningScores, quality: ImageQualityAnalysis): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=enhancement-planning-scorer.d.ts.map