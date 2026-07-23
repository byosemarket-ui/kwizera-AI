import { ImageCacheOptimization, ImageIntelligenceOptimizationRecord, ImageIntelligenceRecoveryPoint } from "./types.js";
export declare class ImageIntelligenceOptimizationRecordStore {
    private storePath;
    private recoveryPath;
    private cachePath;
    private records;
    private recoveryPoints;
    private activeCache;
    initialize(engineDir: string): void;
    upsert(record: ImageIntelligenceOptimizationRecord): void;
    saveRecoveryPoint(point: ImageIntelligenceRecoveryPoint): void;
    getRecoveryPoint(recoveryId: string): ImageIntelligenceRecoveryPoint | undefined;
    updateCache(cache: ImageCacheOptimization): void;
    getCache(): ImageCacheOptimization;
    restoreCache(snapshot: ImageCacheOptimization): void;
    get(optimizationId: string): ImageIntelligenceOptimizationRecord | undefined;
    getByImage(imageId: string): ImageIntelligenceOptimizationRecord[];
    getAll(): ImageIntelligenceOptimizationRecord[];
    getCount(): number;
}
//# sourceMappingURL=image-intelligence-optimization-stores.d.ts.map