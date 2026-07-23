import { CameraMovementRecord } from "./types.js";
export declare class CameraMovementRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: CameraMovementRecord): void;
    get(videoId: string): CameraMovementRecord | undefined;
    getAll(): CameraMovementRecord[];
    getCount(): number;
}
//# sourceMappingURL=camera-movement-stores.d.ts.map