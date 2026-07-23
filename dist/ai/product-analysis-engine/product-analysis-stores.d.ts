import { ProductAnalysisIntelligenceRecord } from "./types.js";
export declare class ProductAnalysisRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ProductAnalysisIntelligenceRecord): void;
    get(productId: string): ProductAnalysisIntelligenceRecord | undefined;
    getAll(): ProductAnalysisIntelligenceRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=product-analysis-stores.d.ts.map