import { BrandKnowledge, DesignKnowledge, ImageQualityScores, ProductPresentation, VisualElements, VisualMetrics } from "./types.js";
export declare class ImageScorer {
    computeScores(visual: VisualElements, metrics: VisualMetrics, product: ProductPresentation, design: DesignKnowledge, brand: BrandKnowledge): ImageQualityScores;
    isAnalysisValid(scores: ImageQualityScores): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=image-scorer.d.ts.map