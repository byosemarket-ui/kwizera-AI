import { ProductAnalysisEngineInput, ProductAnalysisProfile } from "./types.js";
export declare class ProductAnalysisCompletenessDetector {
    detect(input: ProductAnalysisEngineInput, profile: ProductAnalysisProfile): string[];
    isCriticallyIncomplete(missing: string[]): boolean;
}
//# sourceMappingURL=product-analysis-completeness.d.ts.map