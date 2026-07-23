import { VideoGenerationOptimizationRecord } from "./types.js";
export declare class OptimizationRecordStore {
    private storePath;
    private records;
    initialize(engineDir: string): void;
    upsert(record: VideoGenerationOptimizationRecord): void;
    get(optimizationId: string): VideoGenerationOptimizationRecord | undefined;
    getByStoryboard(storyboardId: string): VideoGenerationOptimizationRecord[];
    getAll(): VideoGenerationOptimizationRecord[];
    getCount(): number;
}
//# sourceMappingURL=video-generation-optimization-stores.d.ts.map