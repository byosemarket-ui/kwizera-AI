import { ProductIntelligenceHealthLevel, ProductIntelligenceModuleRegistration, ProductIntelligenceRegistrySnapshot } from "./types.js";
import { ProductIntelligenceFoundationLogger } from "./product-intelligence-logger.js";
import { ProductIntelligenceStorageManager } from "./product-intelligence-storage.js";
export declare class ProductIntelligenceRegistry {
    private readonly logger;
    private modules;
    private storage;
    private storageRoot;
    constructor(logger: ProductIntelligenceFoundationLogger);
    initialize(storage: ProductIntelligenceStorageManager, storageRoot: string): void;
    private seedPreparedModules;
    private loadFromDisk;
    registerModule(registration: Omit<ProductIntelligenceModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt"> & {
        healthStatus?: ProductIntelligenceHealthLevel;
        lastUpdated?: string;
        createdAt?: string;
    }): void;
    getModule(moduleId: string): ProductIntelligenceModuleRegistration | undefined;
    getAllModules(): ProductIntelligenceModuleRegistration[];
    getPreparedCount(): number;
    getRegisteredCount(): number;
    getSnapshot(storageRoot: string): ProductIntelligenceRegistrySnapshot;
    persist(): void;
    private writeChecksum;
    verifyChecksum(): boolean;
    updateHealth(moduleId: string, level: ProductIntelligenceHealthLevel): void;
    updateQualityScores(moduleId: string, qualityScore: number, confidenceScore: number): void;
}
//# sourceMappingURL=product-intelligence-registry.d.ts.map