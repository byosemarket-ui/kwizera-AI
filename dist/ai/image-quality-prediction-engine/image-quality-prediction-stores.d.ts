import { ImageQualityPredictionRecord } from "./types.js";
export declare class ImageQualityPredictionRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ImageQualityPredictionRecord): void;
    get(imageId: string): ImageQualityPredictionRecord | undefined;
    getAll(): ImageQualityPredictionRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=image-quality-prediction-stores.d.ts.map