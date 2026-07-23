import { QualityPredictionRecord } from "./types.js";
export declare class QualityPredictionRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: QualityPredictionRecord): void;
    get(predictionId: string): QualityPredictionRecord | undefined;
    getByProduct(productId: string): QualityPredictionRecord[];
    getAll(): QualityPredictionRecord[];
    getCount(): number;
}
//# sourceMappingURL=quality-prediction-stores.d.ts.map