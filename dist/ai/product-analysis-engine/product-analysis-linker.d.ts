import { ProductAnalysisIntelligenceRecord, ProductAnalysisRelationships, ProductClassification } from "./types.js";
export declare class ProductAnalysisLinker {
    detectRelationships(record: ProductAnalysisIntelligenceRecord, allRecords: ProductAnalysisIntelligenceRecord[], knowledgeIds?: string[], memoryRefs?: string[]): ProductAnalysisRelationships;
    classifySimilarity(a: ProductClassification, b: ProductClassification): number;
}
//# sourceMappingURL=product-analysis-linker.d.ts.map