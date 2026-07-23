import { MultiStyleImageRecord } from "./types.js";
export declare class MultiStyleImageRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: MultiStyleImageRecord): void;
    get(stylePlanId: string): MultiStyleImageRecord | undefined;
    getByProduct(productId: string): MultiStyleImageRecord[];
    getBySourceImage(sourceImageId: string): MultiStyleImageRecord[];
    getAll(): MultiStyleImageRecord[];
    getCount(): number;
}
//# sourceMappingURL=multi-style-image-stores.d.ts.map