import { MarketingAnalysisRecord, MarketingRecommendation, MarketingRelationships } from "./types.js";
export declare class MarketingRecommender {
    recommend(record: MarketingAnalysisRecord): MarketingRecommendation[];
}
export declare class MarketingRelationshipLinker {
    detectSimilar(record: MarketingAnalysisRecord, allRecords: MarketingAnalysisRecord[]): MarketingRelationships;
    private similarityScore;
}
//# sourceMappingURL=marketing-recommender.d.ts.map