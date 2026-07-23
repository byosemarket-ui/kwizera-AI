import { BackgroundAnalysis, BackgroundIntelligenceScores, BackgroundQuality, BackgroundSuitability } from "./types.js";
export declare class BackgroundScorer {
    computeScores(analysis: BackgroundAnalysis, quality: BackgroundQuality, suitability: BackgroundSuitability): BackgroundIntelligenceScores;
    isAnalysisValid(scores: BackgroundIntelligenceScores, backgroundLabel: string): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=background-scorer.d.ts.map