import { ImageAnalysisEngineInput, ImageTechnicalProfile } from "./types.js";
export declare class ImageAnalysisCompletenessDetector {
    detect(input: ImageAnalysisEngineInput, technical: ImageTechnicalProfile): string[];
    isCriticallyIncomplete(missing: string[]): boolean;
}
//# sourceMappingURL=image-analysis-completeness.d.ts.map