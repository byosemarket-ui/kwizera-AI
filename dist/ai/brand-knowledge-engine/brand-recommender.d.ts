import { BrandAnalysisRecord, BrandKnowledgeRecommendation, BrandKnowledgeRelationships } from "./types.js";
export declare class BrandRecommender {
    recommend(record: BrandAnalysisRecord): BrandKnowledgeRecommendation[];
}
export declare class BrandRelationshipLinker {
    detectSimilar(record: BrandAnalysisRecord, allRecords: BrandAnalysisRecord[]): BrandKnowledgeRelationships;
    private similarityScore;
}
//# sourceMappingURL=brand-recommender.d.ts.map