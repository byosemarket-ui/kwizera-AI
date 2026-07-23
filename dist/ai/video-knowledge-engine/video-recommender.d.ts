import { VideoAnalysisRecord, VideoRecommendation, VideoRelationships } from "./types.js";
export declare class VideoRecommender {
    recommend(record: VideoAnalysisRecord): VideoRecommendation[];
}
export declare class VideoRelationshipLinker {
    detectSimilar(record: VideoAnalysisRecord, allRecords: VideoAnalysisRecord[]): VideoRelationships;
    private similarityScore;
}
//# sourceMappingURL=video-recommender.d.ts.map