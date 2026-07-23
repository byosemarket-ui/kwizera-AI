import { BrandingDesignRecord } from "./types.js";
export declare class BrandingDesignRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: BrandingDesignRecord): void;
    get(brandDesignId: string): BrandingDesignRecord | undefined;
    getByProduct(productId: string): BrandingDesignRecord[];
    getByBrand(brandId: string): BrandingDesignRecord[];
    getAll(): BrandingDesignRecord[];
    getCount(): number;
}
//# sourceMappingURL=branding-design-stores.d.ts.map