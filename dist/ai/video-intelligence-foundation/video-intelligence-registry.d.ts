import { VideoIntelligenceHealthLevel, VideoIntelligenceModuleRegistration, VideoIntelligenceRegistrySnapshot } from "./types.js";
import { VideoIntelligenceFoundationLogger } from "./video-intelligence-logger.js";
import { VideoIntelligenceStorageManager } from "./video-intelligence-storage.js";
export declare class VideoIntelligenceRegistry {
    private readonly logger;
    private modules;
    private storage;
    private storageRoot;
    constructor(logger: VideoIntelligenceFoundationLogger);
    initialize(storage: VideoIntelligenceStorageManager, storageRoot: string): void;
    private seedPreparedModules;
    private loadFromDisk;
    registerModule(registration: Omit<VideoIntelligenceModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt"> & {
        healthStatus?: VideoIntelligenceHealthLevel;
        lastUpdated?: string;
        createdAt?: string;
    }): void;
    getModule(moduleId: string): VideoIntelligenceModuleRegistration | undefined;
    getAllModules(): VideoIntelligenceModuleRegistration[];
    getPreparedCount(): number;
    getRegisteredCount(): number;
    getSnapshot(storageRoot: string): VideoIntelligenceRegistrySnapshot;
    persist(): void;
    private writeChecksum;
    verifyChecksum(): boolean;
    updateHealth(moduleId: string, level: VideoIntelligenceHealthLevel): void;
    updateQualityScores(moduleId: string, qualityScore: number, confidenceScore: number): void;
}
//# sourceMappingURL=video-intelligence-registry.d.ts.map