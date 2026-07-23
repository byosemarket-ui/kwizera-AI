import { AudioPlanningRecord } from "./types.js";
export declare class AudioPlanningRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: AudioPlanningRecord): void;
    get(audioPlanId: string): AudioPlanningRecord | undefined;
    getByProduct(productId: string): AudioPlanningRecord[];
    getAll(): AudioPlanningRecord[];
    getCount(): number;
}
//# sourceMappingURL=audio-planning-stores.d.ts.map