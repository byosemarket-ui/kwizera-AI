import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { RecoveryEngineLogger } from "./recovery-logger.js";
import { RecoveryHistoryStore } from "./recovery-history-store.js";
import { FailureReport, RecoveryEngineStatusReport, RecoveryExecutionResult } from "./types.js";
/**
 * AI Recovery Engine — detects failures and restores KWIZERA AI STUDIO to last stable state.
 */
export declare class AiRecoveryEngine {
    private core;
    private moduleManager;
    private stateManager;
    private communicationBus;
    private storageRoot;
    private initialized;
    readonly logger: RecoveryEngineLogger;
    readonly history: RecoveryHistoryStore;
    private readonly diagnostics;
    private readonly backupValidator;
    private readonly memoryProtection;
    private readonly projectRecovery;
    private readonly videoRecovery;
    private readonly selfHealing;
    private detector;
    private executor;
    private lastScanFailures;
    private startupRecoveryComplete;
    initialize(core: AiCoreManager, storageRoot: string, moduleManager?: AiModuleManager, stateManager?: AiStateManager, communicationBus?: AiCommunicationBus): void;
    setModuleManager(manager: AiModuleManager): void;
    setStateManager(manager: AiStateManager): void;
    setCommunicationBus(bus: AiCommunicationBus): void;
    isInitialized(): boolean;
    runStartupRecovery(): Promise<RecoveryExecutionResult[]>;
    scanForFailures(): Promise<FailureReport[]>;
    recoverFromFailure(failure: FailureReport): Promise<RecoveryExecutionResult>;
    recoverModule(moduleId: string): Promise<RecoveryExecutionResult>;
    getLastScanFailures(): FailureReport[];
    isStartupRecoveryComplete(): boolean;
    buildStatusReport(): RecoveryEngineStatusReport;
    private createDeps;
    private refreshDeps;
    private ensureReady;
}
//# sourceMappingURL=recovery-engine.d.ts.map