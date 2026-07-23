import fs from "node:fs";
import path from "node:path";
import { KnowledgeAccessPermission, KnowledgeCategory, KnowledgeModuleStatus, KnowledgeSource, } from "../knowledge-foundation/types.js";
import { KnowledgeAutoRepairHandler } from "./auto-repair-handler.js";
import { KnowledgeEarlyWarningSystem } from "./early-warning-system.js";
import { KnowledgeHealthCheckRunner } from "./health-check-runner.js";
import { KnowledgeHealthMonitorLogger } from "./health-logger.js";
import { KnowledgeHealthHistoryStore, KnowledgeTrendAnalyzer, } from "./health-history-store.js";
import { KnowledgeAuditor } from "./knowledge-auditor.js";
import { KnowledgeModuleHealthChecker } from "./module-health-checker.js";
import { KnowledgeResourceMonitor } from "./resource-monitor.js";
import { KnowledgeHealthReportGenerator } from "./health-report-generator.js";
import { KnowledgeHealthMonitorEngineError, KnowledgeHealthScoreLevel, } from "./types.js";
/**
 * Knowledge Health Monitor — continuously monitors the complete knowledge system.
 */
export class AiKnowledgeHealthMonitorEngine {
    foundation = null;
    storageRoot = "";
    healthDir = "";
    initialized = false;
    startupComplete = false;
    logger = new KnowledgeHealthMonitorLogger();
    history = new KnowledgeHealthHistoryStore();
    moduleChecker = null;
    resourceMonitor = null;
    earlyWarning = null;
    autoRepair = null;
    checkRunner = null;
    auditor = null;
    reportGenerator = null;
    trendAnalyzer = new KnowledgeTrendAnalyzer();
    lastCheck = null;
    lastAudit = null;
    checkTimes = [];
    totalWarnings = 0;
    initialize(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.healthDir = path.join(storageRoot, "knowledge", "health", "engine");
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.history.initialize(this.healthDir);
        this.moduleChecker = new KnowledgeModuleHealthChecker(foundation);
        this.resourceMonitor = new KnowledgeResourceMonitor(foundation, storageRoot);
        this.earlyWarning = new KnowledgeEarlyWarningSystem(foundation);
        this.autoRepair = new KnowledgeAutoRepairHandler(foundation, this.logger);
        this.checkRunner = new KnowledgeHealthCheckRunner(foundation, this.moduleChecker, this.resourceMonitor, this.earlyWarning, this.autoRepair, this.history, this.logger);
        this.auditor = new KnowledgeAuditor(foundation, storageRoot, this.logger);
        this.reportGenerator = new KnowledgeHealthReportGenerator(storageRoot);
        fs.mkdirSync(this.healthDir, { recursive: true });
        this.initialized = true;
        this.logger.log("info", "startup", "Knowledge Health Monitor initialized", { storageRoot });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.foundation.registerKnowledgeModule({
            knowledgeId: "knowledge-health-monitor",
            knowledgeName: "Knowledge Health Monitor",
            category: KnowledgeCategory.HealthMonitoring,
            version: "0.1.0",
            status: KnowledgeModuleStatus.Active,
            dependencies: ["knowledge-engine", "memory-engine"],
            source: KnowledgeSource.KnowledgeModule,
            qualityScore: 95,
            confidenceScore: 94,
            storageLocation: this.healthDir,
            accessPermissions: [
                KnowledgeAccessPermission.Read,
                KnowledgeAccessPermission.Validate,
                KnowledgeAccessPermission.Admin,
            ],
            implemented: true,
        });
        this.lastCheck = await this.runHealthCheck();
        this.lastAudit = await this.runAudit();
        this.startupComplete = true;
        this.logger.log("info", "startup", "Knowledge Health Monitor startup complete", {
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
        if (!result.valid && this.lastCheck) {
            this.logger.log("warn", "audit", "Audit found issues — attempting repair", {
                auditId: result.auditId,
            });
            await this.autoRepair.attemptRepairs(this.lastCheck.warnings);
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
    generateReports() {
        this.ensureReady();
        return this.reportGenerator.generateAll(this.buildStatusReport(), this.lastCheck, this.history.getAll(), this.lastCheck?.moduleScores ?? this.moduleChecker.checkAll());
    }
    buildStatusReport() {
        const avg = (times) => times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        let readinessScore = 100;
        if (!this.initialized)
            readinessScore = 0;
        if (!this.startupComplete)
            readinessScore -= 25;
        if (this.lastCheck && this.lastCheck.overallLevel === KnowledgeHealthScoreLevel.Critical) {
            readinessScore -= 20;
        }
        if (this.lastAudit && !this.lastAudit.valid)
            readinessScore -= 15;
        const trend = this.getTrendAnalysis();
        const moduleScores = this.lastCheck?.moduleScores ?? [];
        const excellent = moduleScores.filter((m) => m.level === KnowledgeHealthScoreLevel.Excellent).length;
        const recommendations = this.lastCheck?.recommendations ?? [];
        const graphModule = moduleScores.find((m) => m.module === "knowledge-graph-engine");
        const relationshipModule = moduleScores.find((m) => m.module === "knowledge-relationships");
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            overallKnowledgeHealth: this.lastCheck
                ? `${this.lastCheck.overallLevel} (${this.lastCheck.overallScore}/100)`
                : "awaiting first check",
            moduleHealthSummary: `${excellent}/${moduleScores.length} modules excellent`,
            knowledgeQuality: this.foundation?.getKnowledgeValidationEngine().buildStatusReport()
                .qualityStatus ?? "awaiting validation",
            graphHealth: graphModule
                ? `${graphModule.score}/100 (${graphModule.level})`
                : "awaiting graph check",
            relationshipHealth: relationshipModule
                ? `${relationshipModule.score}/100 (${relationshipModule.level})`
                : "awaiting relationship check",
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
            throw new KnowledgeHealthMonitorEngineError("Knowledge Health Monitor not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=knowledge-health-monitor-engine.js.map