import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { BackupValidator } from "./backup-validator.js";
import { DiagnosticsGenerator } from "./diagnostics-generator.js";
import { MemoryProtection } from "./memory-protection.js";
import { ProjectRecovery } from "./project-recovery.js";
import { RecoveryEngineLogger } from "./recovery-logger.js";
import { RecoveryHistoryStore } from "./recovery-history-store.js";
import { SelfHealing } from "./self-healing.js";
import { VideoRecovery } from "./video-recovery.js";
import { FailureReport, RecoveryExecutionResult } from "./types.js";
export interface RecoveryExecutorDeps {
    getCore: () => AiCoreManager;
    getModuleManager: () => AiModuleManager | null;
    getStateManager: () => AiStateManager | null;
    getCommunicationBus: () => AiCommunicationBus | null;
    storageRoot: string;
}
export declare class RecoveryExecutor {
    private readonly deps;
    private readonly logger;
    private readonly history;
    private readonly diagnostics;
    private readonly backupValidator;
    private readonly memoryProtection;
    private readonly projectRecovery;
    private readonly videoRecovery;
    private readonly selfHealing;
    private readonly planner;
    private totalRecoveryMs;
    private recoveryCount;
    constructor(deps: RecoveryExecutorDeps, logger: RecoveryEngineLogger, history: RecoveryHistoryStore, diagnostics: DiagnosticsGenerator, backupValidator: BackupValidator, memoryProtection: MemoryProtection, projectRecovery: ProjectRecovery, videoRecovery: VideoRecovery, selfHealing: SelfHealing);
    execute(failure: FailureReport): Promise<RecoveryExecutionResult>;
    getAverageRecoveryMs(): number;
    getRecoveryCount(): number;
    private finalize;
}
//# sourceMappingURL=recovery-executor.d.ts.map