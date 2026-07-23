import { BrandVisualConsistencyCheck, BrandVisualIntelligenceScores, LogoAnalysis } from "./types.js";
export declare class BrandVisualScorer {
    computeScores(consistency: BrandVisualConsistencyCheck, logo: LogoAnalysis): BrandVisualIntelligenceScores;
    isAnalysisValid(scores: BrandVisualIntelligenceScores, brandName: string, consistency: BrandVisualConsistencyCheck): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=brand-visual-scorer.d.ts.map