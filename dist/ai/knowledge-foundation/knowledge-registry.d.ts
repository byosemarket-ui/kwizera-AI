import { KnowledgeHealthLevel, KnowledgeModuleRegistration, KnowledgeRegistrySnapshot } from "./types.js";
import { KnowledgeFoundationLogger } from "./knowledge-logger.js";
import { KnowledgeStorageManager } from "./knowledge-storage.js";
export declare class KnowledgeRegistry {
    private readonly logger;
    private modules;
    private storage;
    private storageRoot;
    constructor(logger: KnowledgeFoundationLogger);
    initialize(storage: KnowledgeStorageManager, storageRoot: string): void;
    private seedPreparedCategories;
    private loadFromDisk;
    registerModule(registration: Omit<KnowledgeModuleRegistration, "lastUpdate" | "healthStatus"> & {
        healthStatus?: KnowledgeHealthLevel;
        lastUpdate?: string;
    }): void;
    getModule(knowledgeId: string): KnowledgeModuleRegistration | undefined;
    getAllModules(): KnowledgeModuleRegistration[];
    getPreparedCount(): number;
    getRegisteredCount(): number;
    getSnapshot(storageRoot: string): KnowledgeRegistrySnapshot;
    persist(): void;
    private writeChecksum;
    verifyChecksum(): boolean;
    updateHealth(knowledgeId: string, level: KnowledgeHealthLevel): void;
    updateQualityScores(knowledgeId: string, qualityScore: number, confidenceScore: number): void;
}
//# sourceMappingURL=knowledge-registry.d.ts.map