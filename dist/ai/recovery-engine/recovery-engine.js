import path from "node:path";
import { BackupValidator } from "./backup-validator.js";
import { DiagnosticsGenerator } from "./diagnostics-generator.js";
import { FailureDetector } from "./failure-detector.js";
import { MemoryProtection } from "./memory-protection.js";
import { ProjectRecovery } from "./project-recovery.js";
import { RecoveryEngineLogger } from "./recovery-logger.js";
import { RecoveryExecutor } from "./recovery-executor.js";
import { RecoveryHistoryStore } from "./recovery-history-store.js";
import { SelfHealing } from "./self-healing.js";
import { VideoRecovery } from "./video-recovery.js";
import { RecoveryEngineError, } from "./types.js";
/**
 * AI Recovery Engine — detects failures and restores KWIZERA AI STUDIO to last stable state.
 */
export class AiRecoveryEngine {
    core = null;
    moduleManager = null;
    stateManager = null;
    communicationBus = null;
    storageRoot = "";
    initialized = false;
    logger = new RecoveryEngineLogger();
    history = new RecoveryHistoryStore();
    diagnostics = new DiagnosticsGenerator(this.logger);
    backupValidator = new BackupValidator(this.logger);
    memoryProtection = new MemoryProtection(this.logger);
    projectRecovery = new ProjectRecovery(this.logger);
    videoRecovery = new VideoRecovery(this.logger);
    selfHealing = new SelfHealing(this.logger);
    detector = null;
    executor = null;
    lastScanFailures = [];
    startupRecoveryComplete = false;
    initialize(core, storageRoot, moduleManager, stateManager, communicationBus) {
        this.core = core;
        this.storageRoot = storageRoot;
        this.moduleManager = moduleManager ?? null;
        this.stateManager = stateManager ?? null;
        this.communicationBus = communicationBus ?? null;
        const logDir = path.join(storageRoot, "logs");
        const recoveryDir = path.join(storageRoot, "recovery");
        this.logger.initialize(logDir);
        this.history.initialize(recoveryDir);
        this.diagnostics.initialize(recoveryDir);
        const deps = this.createDeps();
        this.detector = new FailureDetector(deps, this.logger);
        this.executor = new RecoveryExecutor(deps, this.logger, this.history, this.diagnostics, this.backupValidator, this.memoryProtection, this.projectRecovery, this.videoRecovery, this.selfHealing);
        this.initialized = true;
        this.logger.log("info", "recovery-success", "AI Recovery Engine initialized", { storageRoot });
    }
    setModuleManager(manager) {
        this.moduleManager = manager;
        this.refreshDeps();
    }
    setStateManager(manager) {
        this.stateManager = manager;
        this.refreshDeps();
    }
    setCommunicationBus(bus) {
        this.communicationBus = bus;
        this.refreshDeps();
    }
    isInitialized() {
        return this.initialized;
    }
    async runStartupRecovery() {
        this.ensureReady();
        const results = [];
        this.memoryProtection.verify(this.storageRoot);
        const failures = await this.detector.scanAll();
        this.lastScanFailures = failures;
        const critical = failures.filter((f) => f.severity === "critical" || f.severity === "high");
        const toRecover = critical.length > 0 ? critical : failures.slice(0, 1);
        for (const failure of toRecover) {
            const result = await this.executor.execute(failure);
            results.push(result);
        }
        this.startupRecoveryComplete = true;
        return results;
    }
    async scanForFailures() {
        this.ensureReady();
        this.lastScanFailures = await this.detector.scanAll();
        return this.lastScanFailures;
    }
    async recoverFromFailure(failure) {
        this.ensureReady();
        return this.executor.execute(failure);
    }
    async recoverModule(moduleId) {
        const failure = {
            failureId: `manual-${Date.now()}`,
            failureType: "module",
            affectedComponent: moduleId,
            rootCause: `Manual module recovery requested for ${moduleId}`,
            timestamp: new Date().toISOString(),
            severity: "medium",
            diagnostics: { moduleId },
        };
        return this.recoverFromFailure(failure);
    }
    getLastScanFailures() {
        return this.lastScanFailures;
    }
    isStartupRecoveryComplete() {
        return this.startupRecoveryComplete;
    }
    buildStatusReport() {
        const successRate = this.history.getSuccessRate();
        const knownIssues = [];
        if (this.lastScanFailures.length > 0) {
            knownIssues.push(`${this.lastScanFailures.length} failure(s) detected in last scan`);
        }
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (successRate < 80 && this.history.getCount() > 0)
            readinessScore -= 20;
        const mem = process.memoryUsage();
        return {
            recoveryEngineStatus: this.initialized ? "operational" : "not-initialized",
            failureDetectionStatus: `${this.lastScanFailures.length} failure(s) in last scan`,
            recoverySuccessRate: successRate,
            dataProtectionStatus: this.memoryProtection.verify(this.storageRoot).verified
                ? "memory categories protected"
                : "protection unverified",
            stateRestorationStatus: this.startupRecoveryComplete
                ? "startup recovery complete"
                : "pending startup recovery",
            performance: {
                averageRecoveryMs: this.executor?.getAverageRecoveryMs() ?? 0,
                totalRecoveries: this.history.getCount(),
                failuresDetected: this.lastScanFailures.length,
                selfHealingActions: this.selfHealing.getActionCount(),
            },
            knownIssues,
            readinessScore: Math.max(0, Math.min(100, readinessScore)),
            timestamp: new Date().toISOString(),
        };
    }
    createDeps() {
        return {
            getCore: () => this.core,
            getModuleManager: () => this.moduleManager,
            getStateManager: () => this.stateManager,
            getCommunicationBus: () => this.communicationBus,
            storageRoot: this.storageRoot,
        };
    }
    refreshDeps() {
        if (!this.initialized)
            return;
        const deps = this.createDeps();
        this.detector = new FailureDetector(deps, this.logger);
        this.executor = new RecoveryExecutor(deps, this.logger, this.history, this.diagnostics, this.backupValidator, this.memoryProtection, this.projectRecovery, this.videoRecovery, this.selfHealing);
    }
    ensureReady() {
        if (!this.initialized || !this.core) {
            throw new RecoveryEngineError("Recovery Engine not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=recovery-engine.js.map