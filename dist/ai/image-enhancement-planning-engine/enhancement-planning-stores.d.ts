import { ImageEnhancementPlanningRecord } from "./types.js";
export declare class ImageEnhancementPlanningRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ImageEnhancementPlanningRecord): void;
    get(imageId: string): ImageEnhancementPlanningRecord | undefined;
    getAll(): ImageEnhancementPlanningRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=enhancement-planning-stores.d.ts.map