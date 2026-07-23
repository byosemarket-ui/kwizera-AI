import { ImageIntelligenceHealthLevel, ImageIntelligenceModuleRegistration, ImageIntelligenceRegistrySnapshot } from "./types.js";
import { ImageIntelligenceFoundationLogger } from "./image-intelligence-logger.js";
import { ImageIntelligenceStorageManager } from "./image-intelligence-storage.js";
export declare class ImageIntelligenceRegistry {
    private readonly logger;
    private modules;
    private storage;
    private storageRoot;
    constructor(logger: ImageIntelligenceFoundationLogger);
    initialize(storage: ImageIntelligenceStorageManager, storageRoot: string): void;
    private seedPreparedModules;
    private loadFromDisk;
    registerModule(registration: Omit<ImageIntelligenceModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt"> & {
        healthStatus?: ImageIntelligenceHealthLevel;
        lastUpdated?: string;
        createdAt?: string;
    }): void;
    getModule(moduleId: string): ImageIntelligenceModuleRegistration | undefined;
    getAllModules(): ImageIntelligenceModuleRegistration[];
    getPreparedCount(): number;
    getRegisteredCount(): number;
    getSnapshot(storageRoot: string): ImageIntelligenceRegistrySnapshot;
    persist(): void;
    private writeChecksum;
    verifyChecksum(): boolean;
    updateHealth(moduleId: string, level: ImageIntelligenceHealthLevel): void;
    updateQualityScores(moduleId: string, qualityScore: number, confidenceScore: number): void;
}
//# sourceMappingURL=image-intelligence-registry.d.ts.map