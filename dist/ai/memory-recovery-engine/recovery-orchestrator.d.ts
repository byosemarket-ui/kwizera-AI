import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { AutoRecoveryMonitor } from "./auto-recovery-monitor.js";
import { MemoryRecoveryLogger } from "./recovery-logger.js";
import { PostRecoveryIntegrityChecker } from "./post-recovery-integrity.js";
import { PreRecoveryValidator } from "./pre-recovery-validator.js";
import { RecoveryHistoryStore } from "./recovery-history-store.js";
import { SafetySnapshotManager } from "./safety-snapshot-manager.js";
import { StateComparator } from "./state-comparator.js";
import { MemoryRecoveryRequest, MemoryRecoveryResult } from "./types.js";
export declare class RecoveryOrchestrator {
    private readonly foundation;
    private readonly preValidator;
    private readonly safetySnapshot;
    private readonly stateComparator;
    private readonly postIntegrity;
    private readonly autoRecovery;
    private readonly history;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, preValidator: PreRecoveryValidator, safetySnapshot: SafetySnapshotManager, stateComparator: StateComparator, postIntegrity: PostRecoveryIntegrityChecker, autoRecovery: AutoRecoveryMonitor, history: RecoveryHistoryStore, logger: MemoryRecoveryLogger);
    execute(request: MemoryRecoveryRequest): Promise<MemoryRecoveryResult>;
    private failResult;
}
//# sourceMappingURL=recovery-orchestrator.d.ts.map