import type { ImageAnalysisIntelligenceRecord } from "../image-analysis-engine/types.js";
import type { ImageUnderstandingRecord } from "../image-understanding-engine/types.js";
import { DetectedObject, LogoDetection, ObjectDetectionRecommendation, ProductDetection, TextDetection } from "./types.js";
export declare class ObjectDetectionAnalyzer {
    buildFromIntelligence(analysis: ImageAnalysisIntelligenceRecord, understanding: ImageUnderstandingRecord): {
        objects: DetectedObject[];
        productDetection: ProductDetection;
        textDetection: TextDetection;
        logoDetection: LogoDetection;
        recommendations: ObjectDetectionRecommendation[];
        keywords: string[];
    };
    private createObject;
    private inferObjectType;
    private linkObjectRelationships;
    private buildRecommendations;
}
//# sourceMappingURL=object-detection-analyzer.d.ts.map