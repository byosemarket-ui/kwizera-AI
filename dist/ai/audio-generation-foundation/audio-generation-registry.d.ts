import { AudioGenerationHealthLevel, AudioGenerationModuleRegistration, AudioGenerationRegistrySnapshot } from "./types.js";
import { AudioGenerationFoundationLogger } from "./audio-generation-logger.js";
import { AudioGenerationStorageManager } from "./audio-generation-storage.js";
export declare class AudioGenerationRegistry {
    private readonly logger;
    private modules;
    private storage;
    private storageRoot;
    constructor(logger: AudioGenerationFoundationLogger);
    initialize(storage: AudioGenerationStorageManager, storageRoot: string): void;
    private seedPreparedModules;
    private loadFromDisk;
    registerModule(registration: Omit<AudioGenerationModuleRegistration, "lastUpdated" | "healthStatus" | "createdAt"> & {
        healthStatus?: AudioGenerationHealthLevel;
        lastUpdated?: string;
        createdAt?: string;
    }): void;
    getModule(moduleId: string): AudioGenerationModuleRegistration | undefined;
    getAllModules(): AudioGenerationModuleRegistration[];
    getPreparedCount(): number;
    getRegisteredCount(): number;
    getSnapshot(storageRoot: string): AudioGenerationRegistrySnapshot;
    persist(): void;
    private writeChecksum;
    verifyChecksum(): boolean;
    updateHealth(moduleId: string, level: AudioGenerationHealthLevel): void;
    updateQualityScores(moduleId: string, qualityScore: number, confidenceScore: number): void;
}
//# sourceMappingURL=audio-generation-registry.d.ts.map