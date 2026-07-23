import { ProductAnalysisRecord, ProductKnowledgeLearningPattern } from "./types.js";
export declare class ProductPatternStore {
    private storePath;
    private patterns;
    initialize(productDir: string): void;
    add(pattern: ProductKnowledgeLearningPattern): void;
    getAll(): ProductKnowledgeLearningPattern[];
    getCount(): number;
}
export declare class ProductRecordStore {
    private storePath;
    private records;
    initialize(productDir: string): void;
    upsert(record: ProductAnalysisRecord): void;
    get(productId: string): ProductAnalysisRecord | undefined;
    getAll(): ProductAnalysisRecord[];
    getCount(): number;
}
//# sourceMappingURL=product-stores.d.ts.map