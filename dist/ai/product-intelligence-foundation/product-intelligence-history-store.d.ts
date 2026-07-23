export interface ProductIntelligenceHistoryRecord {
    timestamp: string;
    event: string;
    category?: string;
    operation?: string;
    requesterId?: string;
    durationMs?: number;
    success: boolean;
    detail?: string;
}
export declare class ProductIntelligenceHistoryStore {
    private historyPath;
    private readonly records;
    initialize(intelligenceDirectory: string): void;
    append(record: ProductIntelligenceHistoryRecord): void;
    getRecords(): ReadonlyArray<ProductIntelligenceHistoryRecord>;
    getCount(): number;
}
//# sourceMappingURL=product-intelligence-history-store.d.ts.map