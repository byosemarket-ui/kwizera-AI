import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { AutoRecoveryMonitor } from "./auto-recovery-monitor.js";
import { MemoryRecoveryLogger } from "./recovery-logger.js";
import { PostRecoveryIntegrityChecker } from "./post-recovery-integrity.js";
import { PreRecoveryValidator } from "./pre-recovery-validator.js";
import { RecoveryHistoryStore } from "./recovery-history-store.js";
import { RecoveryOrchestrator } from "./recovery-orchestrator.js";
import { SafetySnapshotManager } from "./safety-snapshot-manager.js";
import { StateComparator } from "./state-comparator.js";
import { MemoryRecoveryEngineError, MemoryRecoverySource, MemoryRecoveryType, } from "./types.js";
/**
 * Memory Recovery Engine — safely restores memory and AI data from backups.
 */
export class AiMemoryRecoveryEngine {
    foundation = null;
    storageRoot = "";
    recoveryDir = "";
    initialized = false;
    startupComplete = false;
    logger = new MemoryRecoveryLogger();
    history = new RecoveryHistoryStore();
    preValidator = null;
    safetySnapshot = null;
    stateComparator = null;
    postIntegrity = null;
    autoRecovery = null;
    orchestrator = null;
    recoveryTimes = [];
    validationTimes = [];
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.recoveryDir = path.join(resolveStoragePath(storageRoot, "memory"), "recovery");
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.history.initialize(this.recoveryDir);
        this.preValidator = new PreRecoveryValidator(foundation, storageRoot, this.logger);
        this.safetySnapshot = new SafetySnapshotManager(foundation, storageRoot, this.logger);
        this.safetySnapshot.initialize(this.recoveryDir);
        this.stateComparator = new StateComparator(foundation);
        this.postIntegrity = new PostRecoveryIntegrityChecker(foundation, storageRoot, this.logger);
        this.autoRecovery = new AutoRecoveryMonitor(foundation, this.logger);
        this.orchestrator = new RecoveryOrchestrator(foundation, this.preValidator, this.safetySnapshot, this.stateComparator, this.postIntegrity, this.autoRecovery, this.history, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Memory Recovery Engine initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        const corruption = this.autoRecovery.detectCorruption();
        if (corruption.detected) {
            this.logger.log("warn", "auto-recovery", "Memory corruption detected — initiating auto recovery", {
                issues: corruption.issues,
            });
            try {
                await this.autoRecover(corruption.issues.join("; "));
            }
            catch (error) {
                this.logger.log("error", "auto-recovery", "Auto recovery failed", {
                    reason: error instanceof Error ? error.message : String(error),
                });
            }
        }
        this.startupComplete = true;
        this.logger.log("info", "startup", "Memory Recovery Engine startup complete", {
            recoveries: this.history.getAll().length,
            durationMs: Date.now() - start,
        });
    }
    async recover(request) {
        this.ensureReady();
        const start = Date.now();
        const result = await this.orchestrator.execute(request);
        this.recoveryTimes.push(result.durationMs);
        this.validationTimes.push(Date.now() - start - result.durationMs);
        return result;
    }
    async recoverProject(projectId, backupId) {
        return this.recover({
            recoveryType: MemoryRecoveryType.Project,
            source: MemoryRecoverySource.ProjectSnapshot,
            backupId,
            projectId,
            reason: `Recover project ${projectId}`,
        });
    }
    async recoverLearning(backupId) {
        return this.recover({
            recoveryType: MemoryRecoveryType.Learning,
            source: MemoryRecoverySource.FullBackup,
            backupId,
            reason: "Recover learning history",
        });
    }
    async recoverRelationships(backupId) {
        return this.recover({
            recoveryType: MemoryRecoveryType.Relationship,
            source: MemoryRecoverySource.FullBackup,
            backupId,
            reason: "Recover relationship memory",
        });
    }
    async recoverConfiguration(backupId) {
        return this.recover({
            recoveryType: MemoryRecoveryType.Configuration,
            source: MemoryRecoverySource.ManualBackup,
            backupId,
            reason: "Recover configuration",
        });
    }
    async autoRecover(reason) {
        const request = this.autoRecovery.buildEmergencyRequest(reason);
        const result = await this.recover(request);
        this.logger.log("info", "auto-recovery", "Auto recovery completed", {
            success: result.success,
            recoveryId: result.recoveryId,
        });
        return result;
    }
    async validateBeforeRecovery(backupId) {
        this.ensureReady();
        const start = Date.now();
        const result = await this.preValidator.validate(backupId);
        this.validationTimes.push(Date.now() - start);
        return result;
    }
    async verifyIntegrity() {
        this.ensureReady();
        return this.postIntegrity.verify();
    }
    detectCorruption() {
        this.ensureReady();
        return this.autoRecovery.detectCorruption();
    }
    getRecoveryHistory() {
        return this.history.getAll();
    }
    getRecoveryDir() {
        return this.recoveryDir;
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        const all = this.history.getAll();
        const successful = all.filter((e) => e.success).length;
        const successRate = this.history.getSuccessRate();
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            recoverySuccessRate: all.length > 0 ? `${successRate}% (${successful}/${all.length})` : "100% (no recoveries yet)",
            integrityStatus: "pre and post recovery validation active",
            projectRecoveryStatus: "project recovery supported",
            learningRecoveryStatus: "learning recovery supported",
            totalRecoveries: all.length,
            successfulRecoveries: successful,
            performance: {
                averageRecoveryMs: avg(this.recoveryTimes),
                averageValidationMs: avg(this.validationTimes),
                lastRecoveryMs: this.recoveryTimes[this.recoveryTimes.length - 1] ?? 0,
            },
            knownIssues: [],
            readinessScore: Math.max(0, readinessScore),
            timestamp: new Date().toISOString(),
        };
    }
    isInitialized() {
        return this.initialized;
    }
    isStartupComplete() {
        return this.startupComplete;
    }
    ensureReady() {
        if (!this.initialized || !this.foundation) {
            throw new MemoryRecoveryEngineError("Memory Recovery Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=memory-recovery-engine.js.map