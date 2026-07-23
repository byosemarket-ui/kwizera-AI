import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { AutoRepairHandler } from "./auto-repair-handler.js";
import { EarlyWarningSystem } from "./early-warning-system.js";
import { HealthCheckRunner } from "./health-check-runner.js";
import { MemoryHealthMonitorLogger } from "./health-logger.js";
import { HealthHistoryStore, TrendAnalyzer } from "./health-history-store.js";
import { MemoryAuditor } from "./memory-auditor.js";
import { ModuleHealthChecker } from "./module-health-checker.js";
import { ResourceMonitor } from "./resource-monitor.js";
import { MemoryHealthMonitorEngineError, MemoryHealthScoreLevel, } from "./types.js";
/**
 * Memory Health Monitor — continuously monitors the complete memory system.
 */
export class AiMemoryHealthMonitorEngine {
    foundation = null;
    storageRoot = "";
    healthDir = "";
    initialized = false;
    startupComplete = false;
    logger = new MemoryHealthMonitorLogger();
    history = new HealthHistoryStore();
    moduleChecker = null;
    resourceMonitor = null;
    earlyWarning = null;
    autoRepair = null;
    checkRunner = null;
    auditor = null;
    trendAnalyzer = new TrendAnalyzer();
    lastCheck = null;
    lastAudit = null;
    checkTimes = [];
    totalWarnings = 0;
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.healthDir = path.join(resolveStoragePath(storageRoot, "memory"), "health");
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.history.initialize(this.healthDir);
        this.moduleChecker = new ModuleHealthChecker(foundation);
        this.resourceMonitor = new ResourceMonitor(foundation, storageRoot);
        this.earlyWarning = new EarlyWarningSystem(foundation);
        this.autoRepair = new AutoRepairHandler(foundation, this.logger);
        this.checkRunner = new HealthCheckRunner(foundation, this.moduleChecker, this.resourceMonitor, this.earlyWarning, this.autoRepair, this.history, this.logger);
        this.auditor = new MemoryAuditor(foundation, storageRoot, this.logger);
        this.initialized = true;
        this.logger.log("info", "startup", "Memory Health Monitor initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.lastCheck = await this.runHealthCheck();
        this.lastAudit = await this.runAudit();
        this.startupComplete = true;
        this.logger.log("info", "startup", "Memory Health Monitor startup complete", {
            overallScore: this.lastCheck.overallScore,
            overallLevel: this.lastCheck.overallLevel,
            durationMs: Date.now() - start,
        });
    }
    async runHealthCheck() {
        this.ensureReady();
        const result = await this.checkRunner.runCheck();
        this.lastCheck = result;
        this.checkTimes.push(result.performance.checkDurationMs);
        this.totalWarnings += result.warnings.length;
        return result;
    }
    async runAudit() {
        this.ensureReady();
        const result = await this.auditor.runAudit();
        this.lastAudit = result;
        if (!result.valid) {
            this.logger.log("warn", "audit", "Audit found issues — attempting repair", {
                auditId: result.auditId,
            });
            if (this.lastCheck) {
                await this.autoRepair.attemptRepairs(this.lastCheck.warnings);
            }
            this.lastAudit = await this.auditor.runAudit();
        }
        return this.lastAudit;
    }
    getModuleScores() {
        this.ensureReady();
        return this.moduleChecker.checkAll();
    }
    getLastCheck() {
        return this.lastCheck;
    }
    getLastAudit() {
        return this.lastAudit;
    }
    getHealthHistory() {
        return this.history.getAll();
    }
    getTrendAnalysis() {
        return this.trendAnalyzer.analyze(this.history.getAll());
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (this.lastCheck && this.lastCheck.overallLevel === MemoryHealthScoreLevel.Critical) {
            readinessScore -= 20;
        }
        if (this.lastAudit && !this.lastAudit.valid)
            readinessScore -= 15;
        const trend = this.getTrendAnalysis();
        const moduleScores = this.lastCheck?.moduleScores ?? [];
        const excellent = moduleScores.filter((m) => m.level === MemoryHealthScoreLevel.Excellent).length;
        const recommendations = this.lastCheck?.recommendations ?? [];
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            overallMemoryHealth: this.lastCheck
                ? `${this.lastCheck.overallLevel} (${this.lastCheck.overallScore}/100)`
                : "awaiting first check",
            moduleHealthSummary: `${excellent}/${moduleScores.length} modules excellent`,
            integrityStatus: this.lastAudit?.valid ? "verified" : "issues detected",
            backupReadiness: this.lastCheck?.backupReadiness ? "ready" : "no backups",
            recoveryReadiness: this.lastCheck?.recoveryReadiness ? "ready" : "not ready",
            totalChecks: this.history.getAll().length,
            totalWarnings: this.totalWarnings,
            performance: {
                averageCheckMs: avg(this.checkTimes),
                lastCheckMs: this.checkTimes[this.checkTimes.length - 1] ?? 0,
                averageDiskMb: this.lastCheck?.performance.diskUsageMb ?? 0,
            },
            trendAnalysis: trend,
            recommendations,
            knownIssues: this.lastCheck?.errors ?? [],
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
    getHealthDir() {
        return this.healthDir;
    }
    ensureReady() {
        if (!this.initialized || !this.foundation) {
            throw new MemoryHealthMonitorEngineError("Memory Health Monitor not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=memory-health-monitor-engine.js.map