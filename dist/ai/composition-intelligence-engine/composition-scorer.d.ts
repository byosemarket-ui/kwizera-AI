import { CompositionAnalysis, CompositionIntelligenceScores, CompositionSuitability, ProductPlacement, VisualHierarchy } from "./types.js";
export declare class CompositionScorer {
    computeScores(composition: CompositionAnalysis, hierarchy: VisualHierarchy, placement: ProductPlacement, suitability: CompositionSuitability): CompositionIntelligenceScores;
    isAnalysisValid(scores: CompositionIntelligenceScores, composition: CompositionAnalysis): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=composition-scorer.d.ts.map