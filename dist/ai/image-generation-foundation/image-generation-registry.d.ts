import { ImageGenerationHealthLevel, ImageGenerationModuleRegistration, ImageGenerationRegistrySnapshot } from "./types.js";
import { ImageGenerationFoundationLogger } from "./image-generation-logger.js";
import { ImageGenerationStorageManager } from "./image-generation-storage.js";
export declare class ImageGenerationRegistry {
    private readonly logger;
    private modules;
    private storage;
    private storageRoot;
    constructor(logger: ImageGenerationFoundationLogger);
    initialize(storage: ImageGenerationStorageManager, storageRoot: string): void;
    private seedPreparedModules;
    private loadFromDisk;
    registerModule(registration: Omit<ImageGenerationModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt"> & {
        healthStatus?: ImageGenerationHealthLevel;
        lastUpdated?: string;
        createdAt?: string;
    }): void;
    getModule(moduleId: string): ImageGenerationModuleRegistration | undefined;
    getAllModules(): ImageGenerationModuleRegistration[];
    getPreparedCount(): number;
    getRegisteredCount(): number;
    getSnapshot(storageRoot: string): ImageGenerationRegistrySnapshot;
    persist(): void;
    private writeChecksum;
    verifyChecksum(): boolean;
    updateHealth(moduleId: string, level: ImageGenerationHealthLevel): void;
    updateQualityScores(moduleId: string, qualityScore: number, confidenceScore: number): void;
}
//# sourceMappingURL=image-generation-registry.d.ts.map