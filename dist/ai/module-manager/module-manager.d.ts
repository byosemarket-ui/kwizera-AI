import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiModulePlugin } from "../core/types.js";
import { ModuleHistoryStore } from "./module-history-store.js";
import { ModuleManagerLogger } from "./module-logger.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { CommunicationRequest, CommunicationResponse, ModuleCommunicationRecord, ModuleManagerStatusReport, ModuleRegistryRecord, RegisterModuleOptions } from "./types.js";
/**
 * AI Module Manager — central controller for every AI module in KWIZERA AI STUDIO.
 */
export declare class AiModuleManager {
    private core;
    private storageRoot;
    private initialized;
    private readonly permanentRegistry;
    private readonly plugins;
    private readonly startupTimes;
    readonly logger: ModuleManagerLogger;
    readonly history: ModuleHistoryStore;
    private readonly dependencyValidator;
    private readonly compatibilityChecker;
    private readonly healthMonitor;
    private readonly router;
    private readonly recovery;
    private _communicationBus;
    private _stateManager;
    constructor();
    initialize(core: AiCoreManager, storageRoot: string): void;
    isInitialized(): boolean;
    setCommunicationBus(bus: AiCommunicationBus): void;
    setStateManager(stateManager: AiStateManager): void;
    isModuleIsolated(moduleId: string): boolean;
    prepareFramework(): void;
    registerModule(options: RegisterModuleOptions): Promise<void>;
    initializeModule(moduleIdOrSlot: string): Promise<void>;
    loadModule(moduleIdOrSlot: string): Promise<void>;
    unloadModule(moduleIdOrSlot: string): Promise<void>;
    enableModule(moduleIdOrSlot: string): void;
    disableModule(moduleIdOrSlot: string): void;
    restartModule(moduleIdOrSlot: string): Promise<boolean>;
    registerAndInitialize(plugin: AiModulePlugin, options?: Omit<RegisterModuleOptions, "plugin">): Promise<void>;
    routeCommunication(request: CommunicationRequest, handler?: (payload: Record<string, unknown> | undefined) => Promise<unknown>): Promise<CommunicationResponse>;
    monitorHealth(moduleIdOrSlot?: string): Promise<void>;
    verifyCompatibility(plugin: AiModulePlugin): boolean;
    getRegistryRecord(moduleId: string): ModuleRegistryRecord | undefined;
    getAllRegistryRecords(): ModuleRegistryRecord[];
    getRegisteredPluginCount(): number;
    getFrameworkCatalogSize(): number;
    getCommunicationRecords(): readonly ModuleCommunicationRecord[];
    getRecoveryDiagnostics(): readonly import("./module-recovery-manager.js").RecoveryDiagnostics[];
    buildStatusReport(): ModuleManagerStatusReport;
    private transitionState;
    private resolveRecord;
    private resolvePlugin;
    private ensureReady;
}
//# sourceMappingURL=module-manager.d.ts.map