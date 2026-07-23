import { ProductUnderstandingRecord } from "./types.js";
export declare class ProductUnderstandingRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ProductUnderstandingRecord): void;
    get(productId: string): ProductUnderstandingRecord | undefined;
    getAll(): ProductUnderstandingRecord[];
    getCount(): number;
}
//# sourceMappingURL=product-understanding-stores.d.ts.map