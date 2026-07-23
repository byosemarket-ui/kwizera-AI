import { ProductionVideoPlanningRecord } from "./types.js";
export declare class ProductionVideoPlanningRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: ProductionVideoPlanningRecord): void;
    get(videoId: string): ProductionVideoPlanningRecord | undefined;
    getAll(): ProductionVideoPlanningRecord[];
    getCount(): number;
}
//# sourceMappingURL=production-video-stores.d.ts.map