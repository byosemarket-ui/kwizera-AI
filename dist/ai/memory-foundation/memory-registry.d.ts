import { MemoryHealthLevel, MemoryModuleRegistration, MemoryRegistrySnapshot } from "./types.js";
import { MemoryFoundationLogger } from "./memory-logger.js";
import { MemoryStorageManager } from "./memory-storage.js";
export declare class MemoryRegistry {
    private readonly logger;
    private modules;
    private storage;
    private storageRoot;
    constructor(logger: MemoryFoundationLogger);
    initialize(storage: MemoryStorageManager, storageRoot: string): void;
    private seedPreparedCategories;
    private loadFromDisk;
    registerModule(registration: MemoryModuleRegistration): void;
    getModule(memoryId: string): MemoryModuleRegistration | undefined;
    getAllModules(): MemoryModuleRegistration[];
    getPreparedCount(): number;
    getRegisteredCount(): number;
    getSnapshot(storageRoot: string): MemoryRegistrySnapshot;
    persist(): void;
    private writeChecksum;
    verifyChecksum(): boolean;
    updateHealth(memoryId: string, level: MemoryHealthLevel): void;
}
//# sourceMappingURL=memory-registry.d.ts.map