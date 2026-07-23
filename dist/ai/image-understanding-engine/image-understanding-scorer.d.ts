import { BrandUnderstanding, ImagePurpose, ImageUnderstandingScores, MarketingUnderstanding, ProductInImageUnderstanding, SceneUnderstanding, VisualUnderstanding } from "./types.js";
export declare class ImageUnderstandingScorer {
    computeScores(purpose: ImagePurpose, scene: SceneUnderstanding, visual: VisualUnderstanding, product: ProductInImageUnderstanding, brand: BrandUnderstanding, marketing: MarketingUnderstanding): ImageUnderstandingScores;
    isUnderstandingValid(scores: ImageUnderstandingScores, purpose: ImagePurpose): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=image-understanding-scorer.d.ts.map