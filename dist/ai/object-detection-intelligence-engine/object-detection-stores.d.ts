import { ObjectDetectionRecord } from "./types.js";
export declare class ObjectDetectionRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ObjectDetectionRecord): void;
    get(imageId: string): ObjectDetectionRecord | undefined;
    getAll(): ObjectDetectionRecord[];
    getCount(): number;
    getTotalObjects(): number;
    private persist;
}
//# sourceMappingURL=object-detection-stores.d.ts.map