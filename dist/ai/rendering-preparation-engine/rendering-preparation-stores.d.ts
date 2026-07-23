import { RenderingPreparationRecord } from "./types.js";
export declare class RenderingPreparationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: RenderingPreparationRecord): void;
    get(renderPlanId: string): RenderingPreparationRecord | undefined;
    getByStoryboard(storyboardId: string): RenderingPreparationRecord[];
    getAll(): RenderingPreparationRecord[];
    getCount(): number;
}
//# sourceMappingURL=rendering-preparation-stores.d.ts.map