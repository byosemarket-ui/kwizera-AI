import { CameraDirectorRecord } from "./types.js";
export declare class CameraDirectorRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: CameraDirectorRecord): void;
    get(cameraPlanId: string): CameraDirectorRecord | undefined;
    getByScene(sceneId: string): CameraDirectorRecord[];
    getByStoryboard(storyboardId: string): CameraDirectorRecord[];
    getByProduct(productId: string): CameraDirectorRecord[];
    getAll(): CameraDirectorRecord[];
    getCount(): number;
}
//# sourceMappingURL=camera-director-stores.d.ts.map