import type { AiModulePlugin } from "../core/types.js";
import { ModuleHistoryStore } from "./module-history-store.js";
import { ModuleManagerLogger } from "./module-logger.js";
import { ModuleCommunicationRouter } from "./communication-router.js";
import { ModuleRegistryRecord } from "./types.js";
export interface RecoveryDiagnostics {
    moduleId: string;
    failureReason: string;
    timestamp: string;
    steps: string[];
}
export declare class ModuleRecoveryManager {
    private readonly history;
    private readonly logger;
    private readonly router;
    private readonly diagnostics;
    private readonly restartCounts;
    constructor(history: ModuleHistoryStore, logger: ModuleManagerLogger, router: ModuleCommunicationRouter);
    getDiagnostics(): ReadonlyArray<RecoveryDiagnostics>;
    getRestartCount(moduleId: string): number;
    recover(record: ModuleRegistryRecord, plugin: AiModulePlugin, reinitialize: () => Promise<void>): Promise<boolean>;
}
//# sourceMappingURL=module-recovery-manager.d.ts.map