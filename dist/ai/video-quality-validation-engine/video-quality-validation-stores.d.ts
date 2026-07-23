import { QualityValidationRecord } from "./types.js";
export declare class QualityValidationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: QualityValidationRecord): void;
    get(validationId: string): QualityValidationRecord | undefined;
    getByStoryboard(storyboardId: string): QualityValidationRecord[];
    getAll(): QualityValidationRecord[];
    getCount(): number;
}
//# sourceMappingURL=video-quality-validation-stores.d.ts.map