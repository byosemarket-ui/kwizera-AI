import { ColorAnalysis, ColorSuitability, LightingAnalysis, LightingColorIntelligenceScores, LightingSuitability } from "./types.js";
export declare class LightingColorScorer {
    computeScores(lighting: LightingAnalysis, color: ColorAnalysis, lightingSuitability: LightingSuitability, colorSuitability: ColorSuitability): LightingColorIntelligenceScores;
    isAnalysisValid(scores: LightingColorIntelligenceScores, color: ColorAnalysis): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=lighting-color-scorer.d.ts.map