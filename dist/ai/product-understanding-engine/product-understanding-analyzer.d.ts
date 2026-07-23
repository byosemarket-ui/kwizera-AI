import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import { CustomerUnderstanding, ProductContext, ProductIdentity, ProductPurpose, ProductUnderstandingMarketingGoal, UnderstandingMarketingPreparation, UniqueValue, ValueAnalysis } from "./types.js";
export declare class ProductUnderstandingAnalyzer {
    buildFromAnalysis(analysis: ProductAnalysisIntelligenceRecord, marketingGoal?: ProductUnderstandingMarketingGoal): {
        identity: ProductIdentity;
        purpose: ProductPurpose;
        customer: CustomerUnderstanding;
        valueAnalysis: ValueAnalysis;
        uniqueValue: UniqueValue;
        context: ProductContext;
        marketingPreparation: UnderstandingMarketingPreparation;
    };
    private inferPrimaryPurpose;
    private inferCustomerNeeds;
    private inferPainPoints;
    private inferBenefits;
    private inferExpectations;
    private analyzeValue;
    private inferMotivations;
    private inferPurchasingSituations;
    private buildMarketingPreparation;
}
//# sourceMappingURL=product-understanding-analyzer.d.ts.map