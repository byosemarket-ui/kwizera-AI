import { SceneGenerationRecord } from "./types.js";
export declare class SceneGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: SceneGenerationRecord): void;
    get(sceneId: string): SceneGenerationRecord | undefined;
    getByStoryboard(storyboardId: string): SceneGenerationRecord[];
    getByProduct(productId: string): SceneGenerationRecord[];
    getAll(): SceneGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=scene-generation-stores.d.ts.map