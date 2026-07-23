import { DetectedObject, LogoDetection, ObjectDetectionScores, ProductDetection, TextDetection } from "./types.js";
export declare class ObjectDetectionScorer {
    computeScores(objects: DetectedObject[], product: ProductDetection, text: TextDetection, logo: LogoDetection): ObjectDetectionScores;
    isDetectionValid(scores: ObjectDetectionScores, objects: DetectedObject[]): {
        valid: boolean;
        diagnostics: string[];
    };
}
//# sourceMappingURL=object-detection-scorer.d.ts.map