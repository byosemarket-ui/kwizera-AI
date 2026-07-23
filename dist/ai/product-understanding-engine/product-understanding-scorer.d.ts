import { CustomerUnderstanding, ProductPurpose, UnderstandingMarketingPreparation, UnderstandingScores, UniqueValue, ValueAnalysis } from "./types.js";
export declare class ProductUnderstandingScorer {
    computeScores(purpose: ProductPurpose, customer: CustomerUnderstanding, value: ValueAnalysis, unique: UniqueValue, marketing: UnderstandingMarketingPreparation): UnderstandingScores;
    isUnderstandingValid(scores: UnderstandingScores, purpose: ProductPurpose): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=product-understanding-scorer.d.ts.map