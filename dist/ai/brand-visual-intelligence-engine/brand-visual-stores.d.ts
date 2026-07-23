import { BrandVisualIntelligenceRecord } from "./types.js";
export declare class BrandVisualIntelligenceRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: BrandVisualIntelligenceRecord): void;
    get(imageId: string): BrandVisualIntelligenceRecord | undefined;
    getAll(): BrandVisualIntelligenceRecord[];
    getCount(): number;
    getByBrand(brandName: string): BrandVisualIntelligenceRecord[];
    private persist;
}
//# sourceMappingURL=brand-visual-stores.d.ts.map