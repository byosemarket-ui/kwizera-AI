import { ImageUnderstandingRecord } from "./types.js";
export declare class ImageUnderstandingRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ImageUnderstandingRecord): void;
    get(imageId: string): ImageUnderstandingRecord | undefined;
    getAll(): ImageUnderstandingRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=image-understanding-stores.d.ts.map