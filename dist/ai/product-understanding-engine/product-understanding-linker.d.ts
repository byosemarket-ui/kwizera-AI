import type { ProductAnalysisIntelligenceRecord } from "../product-analysis-engine/types.js";
import { ProductUnderstandingRecord, ProductUnderstandingRelationships } from "./types.js";
export declare class ProductUnderstandingLinker {
    detectRelationships(record: ProductUnderstandingRecord, allRecords: ProductUnderstandingRecord[], analysis: ProductAnalysisIntelligenceRecord, projects?: string[], knowledgeIds?: string[]): ProductUnderstandingRelationships;
}
//# sourceMappingURL=product-understanding-linker.d.ts.map