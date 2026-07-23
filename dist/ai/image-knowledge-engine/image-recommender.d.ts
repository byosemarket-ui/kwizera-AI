import { ImageAnalysisRecord, ImageRelationships, VisualRecommendation } from "./types.js";
export declare class ImageRecommender {
    recommend(record: ImageAnalysisRecord): VisualRecommendation[];
}
export declare class ImageRelationshipLinker {
    detectSimilar(record: ImageAnalysisRecord, allRecords: ImageAnalysisRecord[]): ImageRelationships;
    private similarityScore;
}
//# sourceMappingURL=image-recommender.d.ts.map