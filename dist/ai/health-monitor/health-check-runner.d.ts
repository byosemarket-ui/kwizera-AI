import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { HealthMonitorLogger } from "./health-logger.js";
import { SystemHealthCheckResult } from "./types.js";
export interface HealthCheckRunnerDeps {
    getCore: () => AiCoreManager;
    getModuleManager: () => AiModuleManager | null;
    getStateManager: () => AiStateManager | null;
    getCommunicationBus: () => AiCommunicationBus | null;
    getRecoveryEngine: () => AiRecoveryEngine | null;
    storageRoot: string;
}
export declare class HealthCheckRunner {
    private readonly deps;
    private readonly logger;
    constructor(deps: HealthCheckRunnerDeps, logger: HealthMonitorLogger);
    runAll(): Promise<SystemHealthCheckResult[]>;
    checkModule(moduleId: string): Promise<SystemHealthCheckResult[]>;
    private checkApplication;
    private checkConfiguration;
    private checkStorage;
    private checkDatabase;
    private checkRuntime;
    private checkCommunication;
    private checkLogs;
    private checkModules;
    private checkSingleModule;
    private checkQueues;
    private checkTasks;
    private checkWorkflows;
    private checkProjects;
    private checkSessions;
    private checkDesktopServices;
}
//# sourceMappingURL=health-check-runner.d.ts.map