import { BrandAnalysisRecord, BrandKnowledgeLearningPattern } from "./types.js";
export declare class BrandPatternStore {
    private storePath;
    private patterns;
    initialize(brandDir: string): void;
    add(pattern: BrandKnowledgeLearningPattern): void;
    getAll(): BrandKnowledgeLearningPattern[];
    getCount(): number;
}
export declare class BrandRecordStore {
    private storePath;
    private records;
    initialize(brandDir: string): void;
    upsert(record: BrandAnalysisRecord): void;
    get(brandId: string): BrandAnalysisRecord | undefined;
    getAll(): BrandAnalysisRecord[];
    getCount(): number;
}
//# sourceMappingURL=brand-stores.d.ts.map