import { CreativeAnalysisRecord, CreativeKnowledgeRecommendation, CreativeKnowledgeRelationships } from "./types.js";
export declare class CreativeRecommender {
    recommend(record: CreativeAnalysisRecord): CreativeKnowledgeRecommendation[];
}
export declare class CreativeRelationshipLinker {
    detectSimilar(record: CreativeAnalysisRecord, allRecords: CreativeAnalysisRecord[]): CreativeKnowledgeRelationships;
    private similarityScore;
}
//# sourceMappingURL=creative-recommender.d.ts.map