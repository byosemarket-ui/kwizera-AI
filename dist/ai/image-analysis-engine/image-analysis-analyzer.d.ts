import { ImageAnalysisEngineInput, ImageClassification, ImageContentPreparation, ImageTechnicalProfile, ImageVisualAnalysis } from "./types.js";
export declare class ImageAnalysisAnalyzer {
    analyze(input: ImageAnalysisEngineInput): {
        technical: ImageTechnicalProfile;
        visual: ImageVisualAnalysis;
        content: ImageContentPreparation;
        classification: ImageClassification;
    };
    private inferFormat;
    private inferCompression;
    private computeAspectRatio;
    private computeOrientation;
    private classifyImageType;
    private inferDominantColors;
    private inferColorDistribution;
    private inferBackground;
}
//# sourceMappingURL=image-analysis-analyzer.d.ts.map