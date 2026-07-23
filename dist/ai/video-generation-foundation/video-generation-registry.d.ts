import { VideoGenerationHealthLevel, VideoGenerationModuleRegistration, VideoGenerationRegistrySnapshot } from "./types.js";
import { VideoGenerationFoundationLogger } from "./video-generation-logger.js";
import { VideoGenerationStorageManager } from "./video-generation-storage.js";
export declare class VideoGenerationRegistry {
    private readonly logger;
    private modules;
    private storage;
    private storageRoot;
    constructor(logger: VideoGenerationFoundationLogger);
    initialize(storage: VideoGenerationStorageManager, storageRoot: string): void;
    private seedPreparedModules;
    private loadFromDisk;
    registerModule(registration: Omit<VideoGenerationModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt"> & {
        healthStatus?: VideoGenerationHealthLevel;
        lastUpdated?: string;
        createdAt?: string;
    }): void;
    getModule(moduleId: string): VideoGenerationModuleRegistration | undefined;
    getAllModules(): VideoGenerationModuleRegistration[];
    getPreparedCount(): number;
    getRegisteredCount(): number;
    getSnapshot(storageRoot: string): VideoGenerationRegistrySnapshot;
    persist(): void;
    private writeChecksum;
    verifyChecksum(): boolean;
    updateHealth(moduleId: string, level: VideoGenerationHealthLevel): void;
    updateQualityScores(moduleId: string, qualityScore: number, confidenceScore: number): void;
}
//# sourceMappingURL=video-generation-registry.d.ts.map