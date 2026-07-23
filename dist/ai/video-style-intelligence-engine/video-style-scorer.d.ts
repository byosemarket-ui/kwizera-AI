import { BrandStyleAnalysis, StyleQualityScores, VisualStyleAnalysis, EditingStyleAnalysis } from "./types.js";
export declare class VideoStyleScorer {
    computeScores(visual: VisualStyleAnalysis, editing: EditingStyleAnalysis, brand: BrandStyleAnalysis, cinematicScoreBase: number, marketingBase: number, templateMatchScore: number): StyleQualityScores;
    isAnalysisValid(scores: StyleQualityScores, cinematicStyleCount: number, templateCount: number): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=video-style-scorer.d.ts.map