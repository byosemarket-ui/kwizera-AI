import { MarketingAnalysisRecord, MarketingLearningPattern } from "./types.js";
export declare class MarketingPatternStore {
    private storePath;
    private patterns;
    initialize(marketingDir: string): void;
    add(pattern: MarketingLearningPattern): void;
    getAll(): MarketingLearningPattern[];
    getCount(): number;
}
export declare class MarketingRecordStore {
    private storePath;
    private records;
    initialize(marketingDir: string): void;
    upsert(record: MarketingAnalysisRecord): void;
    get(campaignId: string): MarketingAnalysisRecord | undefined;
    getAll(): MarketingAnalysisRecord[];
    getCount(): number;
}
//# sourceMappingURL=marketing-stores.d.ts.map