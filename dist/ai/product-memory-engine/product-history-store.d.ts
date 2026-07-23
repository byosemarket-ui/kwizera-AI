export interface ProductHistoryEvent {
    timestamp: string;
    event: "create" | "update" | "learn" | "pattern" | "preference";
    productId: string;
    detail: string;
    version?: number;
}
export declare class ProductHistoryStore {
    private historyPath;
    private readonly events;
    initialize(productDir: string): void;
    append(event: ProductHistoryEvent): void;
    getAll(): ReadonlyArray<ProductHistoryEvent>;
    getByProduct(productId: string): ProductHistoryEvent[];
    getCount(): number;
}
//# sourceMappingURL=product-history-store.d.ts.map