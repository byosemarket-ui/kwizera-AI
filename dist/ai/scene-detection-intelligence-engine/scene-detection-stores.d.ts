import { SceneDetectionRecord } from "./types.js";
export declare class SceneDetectionRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: SceneDetectionRecord): void;
    get(videoId: string): SceneDetectionRecord | undefined;
    getAll(): SceneDetectionRecord[];
    getCount(): number;
    private persist;
}
//# sourceMappingURL=scene-detection-stores.d.ts.map