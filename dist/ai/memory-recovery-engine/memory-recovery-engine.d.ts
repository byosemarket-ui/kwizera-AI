import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryRecoveryLogger } from "./recovery-logger.js";
import { RecoveryHistoryStore } from "./recovery-history-store.js";
import { MemoryRecoveryRequest, MemoryRecoveryResult, MemoryRecoveryStatusReport, PostRecoveryIntegrity, PreRecoveryValidation, RecoveryHistoryEntry } from "./types.js";
/**
 * Memory Recovery Engine — safely restores memory and AI data from backups.
 */
export declare class AiMemoryRecoveryEngine {
    private foundation;
    private storageRoot;
    private recoveryDir;
    private initialized;
    private startupComplete;
    readonly logger: MemoryRecoveryLogger;
    readonly history: RecoveryHistoryStore;
    private preValidator;
    private safetySnapshot;
    private stateComparator;
    private postIntegrity;
    private autoRecovery;
    private orchestrator;
    private recoveryTimes;
    private validationTimes;
    initialize(foundation: AiMemoryFoundation, storageRoot: string): void;
    runStartup(): Promise<void>;
    recover(request: MemoryRecoveryRequest): Promise<MemoryRecoveryResult>;
    recoverProject(projectId: string, backupId?: string): Promise<MemoryRecoveryResult>;
    recoverLearning(backupId?: string): Promise<MemoryRecoveryResult>;
    recoverRelationships(backupId?: string): Promise<MemoryRecoveryResult>;
    recoverConfiguration(backupId?: string): Promise<MemoryRecoveryResult>;
    autoRecover(reason: string): Promise<MemoryRecoveryResult>;
    validateBeforeRecovery(backupId: string): Promise<PreRecoveryValidation>;
    verifyIntegrity(): Promise<PostRecoveryIntegrity>;
    detectCorruption(): import("./auto-recovery-monitor.js").CorruptionReport;
    getRecoveryHistory(): RecoveryHistoryEntry[];
    getRecoveryDir(): string;
    buildStatusReport(): MemoryRecoveryStatusReport;
    isInitialized(): boolean;
    isStartupComplete(): boolean;
    private ensureReady;
}
//# sourceMappingURL=memory-recovery-engine.d.ts.map