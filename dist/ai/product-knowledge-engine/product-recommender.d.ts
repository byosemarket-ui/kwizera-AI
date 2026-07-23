import { ProductAnalysisRecord, ProductKnowledgeRecommendation, ProductKnowledgeRelationships } from "./types.js";
export declare class ProductRecommender {
    recommend(record: ProductAnalysisRecord): ProductKnowledgeRecommendation[];
}
export declare class ProductRelationshipLinker {
    detectSimilar(record: ProductAnalysisRecord, allRecords: ProductAnalysisRecord[]): ProductKnowledgeRelationships;
    private similarityScore;
}
//# sourceMappingURL=product-recommender.d.ts.map