import { ProductBrandKnowledge, ProductCustomerKnowledge, ProductKnowledgeQualityScores, ProductMarketingKnowledge, ProductProfileKnowledge, ProductVisualKnowledge } from "./types.js";
export declare class ProductScorer {
    computeScores(profile: ProductProfileKnowledge, visual: ProductVisualKnowledge, brand: ProductBrandKnowledge, marketing: ProductMarketingKnowledge, customer: ProductCustomerKnowledge): ProductKnowledgeQualityScores;
    isAnalysisValid(profile: ProductProfileKnowledge, scores: ProductKnowledgeQualityScores): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=product-scorer.d.ts.map