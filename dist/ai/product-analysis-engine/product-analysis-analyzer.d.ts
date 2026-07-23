import { ProductAnalysisEngineInput, ProductAnalysisProfile, ProductClassification, ProductMarketingPreparation, ProductVisualPreparation } from "./types.js";
export declare class ProductAnalysisAnalyzer {
    analyze(input: ProductAnalysisEngineInput): {
        profile: ProductAnalysisProfile;
        visual: ProductVisualPreparation;
        classification: ProductClassification;
        marketingPreparation: ProductMarketingPreparation;
    };
    private inferUseCase;
    private inferTargetCustomer;
    private buildMarketingPreparation;
}
//# sourceMappingURL=product-analysis-analyzer.d.ts.map