import { LanguageAnalysisRecord, LanguageKnowledgeRecommendation, LanguageKnowledgeRelationships } from "./types.js";
export declare class LanguageRecommender {
    recommend(record: LanguageAnalysisRecord): LanguageKnowledgeRecommendation[];
}
export declare class LanguageRelationshipLinker {
    detectSimilar(record: LanguageAnalysisRecord, allRecords: LanguageAnalysisRecord[]): LanguageKnowledgeRelationships;
    private similarityScore;
}
//# sourceMappingURL=language-recommender.d.ts.map