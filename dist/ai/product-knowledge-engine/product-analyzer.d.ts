import { ProductAnalysisInput, ProductBrandKnowledge, ProductCustomerKnowledge, ProductMarketingKnowledge, ProductProfileKnowledge, ProductVisualKnowledge } from "./types.js";
export declare class ProductAnalyzer {
    analyze(input: ProductAnalysisInput): {
        profile: ProductProfileKnowledge;
        visual: ProductVisualKnowledge;
        brand: ProductBrandKnowledge;
        marketing: ProductMarketingKnowledge;
        customer: ProductCustomerKnowledge;
    };
}
//# sourceMappingURL=product-analyzer.d.ts.map