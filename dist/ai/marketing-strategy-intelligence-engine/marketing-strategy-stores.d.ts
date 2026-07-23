import { MarketingStrategyRecord } from "./types.js";
export declare class MarketingStrategyRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: MarketingStrategyRecord): void;
    get(strategyId: string): MarketingStrategyRecord | undefined;
    getByProduct(productId: string): MarketingStrategyRecord[];
    getAll(): MarketingStrategyRecord[];
    getCount(): number;
}
//# sourceMappingURL=marketing-strategy-stores.d.ts.map