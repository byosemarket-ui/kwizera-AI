import { ProductAnalysisProfile, ProductClassification, ProductCompletenessScores, ProductMarketingPreparation, ProductVisualPreparation } from "./types.js";
export declare class ProductAnalysisScorer {
    computeScores(profile: ProductAnalysisProfile, visual: ProductVisualPreparation, classification: ProductClassification, marketing: ProductMarketingPreparation, missingFields: string[]): ProductCompletenessScores;
    isAnalysisValid(scores: ProductCompletenessScores, missingFields: string[], criticallyIncomplete: boolean): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=product-analysis-scorer.d.ts.map