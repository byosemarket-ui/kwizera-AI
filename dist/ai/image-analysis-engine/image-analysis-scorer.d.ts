import { ImageCompletenessScores, ImageContentPreparation, ImageTechnicalProfile, ImageVisualAnalysis } from "./types.js";
export declare class ImageAnalysisScorer {
    computeScores(technical: ImageTechnicalProfile, visual: ImageVisualAnalysis, content: ImageContentPreparation, missingFields: string[]): ImageCompletenessScores;
    isAnalysisValid(scores: ImageCompletenessScores, missingFields: string[], criticallyIncomplete: boolean): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=image-analysis-scorer.d.ts.map