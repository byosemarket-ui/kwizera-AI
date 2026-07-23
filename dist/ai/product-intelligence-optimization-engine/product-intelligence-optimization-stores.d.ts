import { CacheOptimization, ProductIntelligenceOptimizationRecord, ProductIntelligenceRecoveryPoint } from "./types.js";
export declare class ProductIntelligenceOptimizationRecordStore {
    private storePath;
    private recoveryPath;
    private cachePath;
    private records;
    private recoveryPoints;
    private activeCache;
    initialize(engineDir: string): void;
    upsert(record: ProductIntelligenceOptimizationRecord): void;
    saveRecoveryPoint(point: ProductIntelligenceRecoveryPoint): void;
    getRecoveryPoint(recoveryId: string): ProductIntelligenceRecoveryPoint | undefined;
    updateCache(cache: CacheOptimization): void;
    getCache(): CacheOptimization;
    restoreCache(snapshot: CacheOptimization): void;
    get(optimizationId: string): ProductIntelligenceOptimizationRecord | undefined;
    getByProduct(productId: string): ProductIntelligenceOptimizationRecord[];
    getAll(): ProductIntelligenceOptimizationRecord[];
    getCount(): number;
}
//# sourceMappingURL=product-intelligence-optimization-stores.d.ts.map