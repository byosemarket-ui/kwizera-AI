import { BrandKnowledge, DesignKnowledge, ImageAnalysisInput, ImageType, ProductPresentation, VisualElements, VisualMetrics } from "./types.js";
export declare class ImageAnalyzer {
    analyze(input: ImageAnalysisInput): {
        visual: VisualElements;
        metrics: VisualMetrics;
        productPresentation: ProductPresentation;
        design: DesignKnowledge;
        brand: BrandKnowledge;
        imageType: ImageType;
    };
    private computeAspectRatio;
}
//# sourceMappingURL=image-analyzer.d.ts.map