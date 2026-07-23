import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { RecoveryEngineLogger } from "./recovery-logger.js";
import { FailureReport } from "./types.js";
export interface FailureDetectorDeps {
    getCore: () => AiCoreManager;
    getModuleManager: () => AiModuleManager | null;
    getStateManager: () => AiStateManager | null;
    getCommunicationBus: () => AiCommunicationBus | null;
    storageRoot: string;
}
export declare class FailureDetector {
    private readonly deps;
    private readonly logger;
    private readonly detectedFailures;
    constructor(deps: FailureDetectorDeps, logger: RecoveryEngineLogger);
    scanAll(): Promise<FailureReport[]>;
    getDetectedFailures(): ReadonlyArray<FailureReport>;
    private checkApplication;
    private checkAiCore;
    private checkModuleManager;
    private checkWorkflowEngine;
    private checkTaskManager;
    private checkCommunicationBus;
    private checkStateManager;
    private checkStorage;
    private checkConfiguration;
    private checkUnexpectedShutdown;
    private createReport;
}
//# sourceMappingURL=failure-detector.d.ts.map