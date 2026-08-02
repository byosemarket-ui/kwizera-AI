import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModel, AiModelCategory, HardwareSnapshot, ModelLog, ModelSettings } from "./types.js";
/** Central lifecycle controller for local model metadata and local artifacts. It never performs generation. */
export declare class AiModelManager {
    private root;
    private core;
    private store;
    private cache;
    readonly registry: ModelRegistry;
    readonly local: LocalModelManager;
    readonly installer: ModelInstaller;
    readonly downloader: ModelDownloader;
    readonly loader: ModelLoader;
    readonly configuration: ModelConfigurationManager;
    readonly versions: ModelVersionManager;
    readonly updates: ModelUpdateManager;
    readonly validation: ModelValidationManager;
    readonly health: ModelHealthMonitor;
    readonly gpu: GpuDetectionManager;
    readonly cpu: CpuDetectionManager;
    readonly ram: RamDetectionManager;
    readonly storage: StorageDetectionManager;
    readonly resources: AiResourceManager;
    readonly performance: ModelPerformanceMonitor;
    readonly cacheManager: ModelCacheManager;
    readonly security: ModelSecurityManager;
    readonly settings: AiSettingsManager;
    initialize(storageRoot: string, core?: AiCoreManager): Promise<void>;
    isInitialized(): boolean;
    dashboard(): Promise<{
        installed: AiModel[];
        available: AiModel[];
        hardware: HardwareSnapshot;
        settings: ModelSettings;
        logs: ModelLog[];
        performance: Record<string, number>;
        integrations: Record<string, boolean>;
    }>;
    list(): AiModel[];
    register(input: Omit<AiModel, "status" | "health" | "usageCount">): Promise<AiModel>;
    install(modelId: string, sourcePath?: string): Promise<AiModel>;
    load(modelId: string): Promise<AiModel>;
    unload(modelId: string): Promise<AiModel>;
    remove(modelId: string): Promise<void>;
    update(modelId: string, version: string): Promise<AiModel>;
    selectBest(category: AiModelCategory): Promise<AiModel | null>;
    detectHardware(): Promise<HardwareSnapshot>;
    recover(): Promise<void>;
    getMutable(id: string): AiModel;
    log(level: ModelLog["level"], event: string, detail: string, modelId?: string): void;
    persist(): Promise<void>;
    private readStore;
    private integrationStatus;
    private assertReady;
}
export declare class ModelRegistry {
    private readonly manager;
    constructor(manager: AiModelManager);
    list(): AiModel[];
    register(model: Omit<AiModel, "status" | "health" | "usageCount">): Promise<AiModel>;
}
export declare class LocalModelManager {
    private readonly manager;
    constructor(manager: AiModelManager);
    unload(modelId: string): Promise<AiModel>;
    remove(modelId: string): Promise<void>;
}
export declare class ModelInstaller {
    private readonly manager;
    constructor(manager: AiModelManager);
    install(modelId: string, sourcePath?: string): Promise<AiModel>;
}
export declare class ModelDownloader {
    private readonly manager;
    constructor(manager: AiModelManager);
    stageLocalArtifact(modelId: string, sourcePath: string): Promise<AiModel>;
}
export declare class ModelLoader {
    private readonly manager;
    constructor(manager: AiModelManager);
    load(modelId: string): Promise<AiModel>;
    unload(modelId: string): Promise<AiModel>;
}
export declare class ModelConfigurationManager {
    private readonly manager;
    constructor(manager: AiModelManager);
    configure(settings: Partial<ModelSettings>): Promise<ModelSettings>;
}
export declare class ModelVersionManager {
    private readonly manager;
    constructor(manager: AiModelManager);
    getVersion(modelId: string): string;
}
export declare class ModelUpdateManager {
    private readonly manager;
    constructor(manager: AiModelManager);
    update(modelId: string, version: string): Promise<AiModel>;
}
export declare class ModelValidationManager {
    private readonly manager;
    constructor(manager: AiModelManager);
    validate(model: AiModel): Promise<void>;
}
export declare class ModelHealthMonitor {
    private readonly manager;
    constructor(manager: AiModelManager);
    scan(): Promise<AiModel[]>;
}
export declare class GpuDetectionManager {
    detect(): Promise<HardwareSnapshot["gpu"]>;
}
export declare class CpuDetectionManager {
    detect(): Promise<HardwareSnapshot["cpu"]>;
}
export declare class RamDetectionManager {
    detect(): Promise<HardwareSnapshot["ram"]>;
}
export declare class StorageDetectionManager {
    detect(root: string): Promise<HardwareSnapshot["storage"]>;
}
export declare class AiResourceManager {
    private readonly manager;
    constructor(manager: AiModelManager);
    canUse(model: AiModel, hardware: HardwareSnapshot): boolean;
    assertAvailable(model: AiModel, hardware: HardwareSnapshot): void;
}
export declare class ModelPerformanceMonitor {
    private readonly manager;
    constructor(manager: AiModelManager);
    snapshot(): Record<string, number>;
}
export declare class ModelCacheManager {
    private readonly manager;
    private cache;
    constructor(manager: AiModelManager);
    touch(model: AiModel): void;
    size(): number;
}
export declare class ModelSecurityManager {
    private readonly manager;
    constructor(manager: AiModelManager);
    assertSafeModel(model: Pick<AiModel, "id" | "name" | "sourcePath" | "artifactPath">): void;
    assertSafeArtifactPath(value: string): void;
}
export declare class AiSettingsManager {
    private readonly manager;
    constructor(manager: AiModelManager);
    get(): ModelSettings;
    update(changes: Partial<ModelSettings>): Promise<ModelSettings>;
}
//# sourceMappingURL=ai-model-manager.d.ts.map