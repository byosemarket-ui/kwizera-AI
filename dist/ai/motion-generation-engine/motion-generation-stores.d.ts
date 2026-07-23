import { MotionGenerationRecord } from "./types.js";
export declare class MotionGenerationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: MotionGenerationRecord): void;
    get(motionPlanId: string): MotionGenerationRecord | undefined;
    getByScene(sceneId: string): MotionGenerationRecord[];
    getByStoryboard(storyboardId: string): MotionGenerationRecord[];
    getAll(): MotionGenerationRecord[];
    getCount(): number;
}
//# sourceMappingURL=motion-generation-stores.d.ts.map