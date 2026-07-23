import fs from "node:fs";
import path from "node:path";
import { DEFAULT_STORAGE_ROOT } from "../../storage/paths/storage-paths.js";
import { VideoGenerationAccessPermission, VideoGenerationCategory, VideoGenerationModuleStatus, } from "../video-generation-foundation/types.js";
import { VideoGenerationAutoRepairHandler } from "./auto-repair-handler.js";
import { VideoGenerationEarlyWarningSystem } from "./early-warning-system.js";
import { VideoGenerationHealthCheckRunner } from "./health-check-runner.js";
import { VideoGenerationHealthMonitorLogger } from "./health-logger.js";
import { VideoGenerationHealthHistoryStore, VideoGenerationTrendAnalyzer, } from "./health-history-store.js";
import { VideoGenerationHealthReportGenerator } from "./health-report-generator.js";
import { VideoGenerationModuleHealthChecker } from "./module-health-checker.js";
import { VideoGenerationResourceMonitor } from "./resource-monitor.js";
import { VideoGenerationAuditor } from "./video-generation-auditor.js";
import { VideoGenerationHealthMonitorEngineError, VideoGenerationHealthScoreLevel, } from "./types.js";
/**
 * AI Video Generation Health Monitor — continuously monitors health, integrity,
 * quality, availability and performance of the entire AI Video Generation System.
 */
export class AiVideoGenerationHealthMonitorEngine {
    foundation = null;
    storageRoot = "";
    healthDir = "";
    projectStateDir = "";
    initialized = false;
    startupComplete = false;
    logger = new VideoGenerationHealthMonitorLogger();
    history = new VideoGenerationHealthHistoryStore();
    moduleChecker = null;
    resourceMonitor = null;
    earlyWarning = null;
    autoRepair = null;
    checkRunner = null;
    auditor = null;
    reportGenerator = null;
    trendAnalyzer = new VideoGenerationTrendAnalyzer();
    lastCheck = null;
    lastAudit = null;
    checkTimes = [];
    totalWarnings = 0;
    initialize(foundation, storageRoot, projectStateDir) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.healthDir = path.join(foundation.getGenerationRoot(), "health", "engine");
        this.projectStateDir =
            projectStateDir ?? path.join(DEFAULT_STORAGE_ROOT, "project-state");
        const logDir = path.join(DEFAULT_STORAGE_ROOT, "logs");
        this.logger.initialize(logDir);
        this.history.initialize(this.healthDir);
        this.moduleChecker = new VideoGenerationModuleHealthChecker(foundation);
        this.resourceMonitor = new VideoGenerationResourceMonitor(foundation, storageRoot);
        this.earlyWarning = new VideoGenerationEarlyWarningSystem(foundation);
        this.autoRepair = new VideoGenerationAutoRepairHandler(foundation, this.logger);
        this.checkRunner = new VideoGenerationHealthCheckRunner(foundation, this.moduleChecker, this.resourceMonitor, this.earlyWarning, this.autoRepair, this.history, this.logger);
        this.auditor = new VideoGenerationAuditor(foundation, storageRoot, this.logger);
        this.reportGenerator = new VideoGenerationHealthReportGenerator(this.projectStateDir);
        fs.mkdirSync(this.healthDir, { recursive: true });
        this.initialized = true;
        this.logger.log("info", "startup", "Video Generation Health Monitor initialized", {
            healthDir: this.healthDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.foundation.registerVideoGenerationModule({
            moduleId: "generation-health-monitor",
            moduleName: "Video Generation Health Monitor",
            category: VideoGenerationCategory.GenerationHealthMonitoring,
            version: "0.1.0",
            status: VideoGenerationModuleStatus.Active,
            dependencies: [
                "video-generation-engine",
                "story-generation-engine",
                "scene-generation-engine",
                "camera-planning-generation-engine",
                "motion-planning-generation-engine",
                "animation-planning-generation-engine",
                "visual-effects-planning-generation-engine",
                "audio-sync-generation-engine",
                "marketing-video-generation-engine",
                "video-production-generation-engine",
                "rendering-planning-generation-engine",
                "video-quality-validation-engine",
                "video-generation-optimization-engine",
            ],
            qualityScore: 95,
            confidenceScore: 94,
            storageLocation: path.join(this.foundation.getGenerationRoot(), "health"),
            accessPermissions: [
                VideoGenerationAccessPermission.Read,
                VideoGenerationAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.lastCheck = await this.runHealthCheck();
        this.lastAudit = await this.runAudit();
        this.startupComplete = true;
        this.logger.log("info", "startup", "Video Generation Health Monitor startup complete", {
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
        if (this.lastCheck && this.lastCheck.overallLevel === VideoGenerationHealthScoreLevel.Critical) {
            readinessScore -= 20;
        }
        if (this.lastAudit && !this.lastAudit.valid)
            readinessScore -= 15;
        const trend = this.getTrendAnalysis();
        const moduleScores = this.lastCheck?.moduleScores ?? [];
        const excellent = moduleScores.filter((m) => m.level === VideoGenerationHealthScoreLevel.Excellent).length;
        const recommendations = this.lastCheck?.recommendations ?? [];
        const storyReport = this.foundation?.getStoryGenerationEngine().buildStatusReport();
        const productionReport = this.foundation?.getVideoProductionEngine().buildStatusReport();
        const renderReport = this.foundation?.getRenderingPreparationEngine().buildStatusReport();
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            overallVideoGenerationHealth: this.lastCheck
                ? `${this.lastCheck.overallLevel} (${this.lastCheck.overallScore}/100)`
                : "awaiting first check",
            moduleHealthSummary: `${excellent}/${moduleScores.length} modules excellent`,
            storyboardHealth: storyReport
                ? `${storyReport.averageProductionReadinessScore || storyReport.readinessScore}/100 storyboard readiness`
                : "awaiting storyboard check",
            productionHealth: productionReport
                ? `${productionReport.averageProductionReadinessScore}/100 production readiness`
                : "awaiting production check",
            renderReadinessHealth: renderReport
                ? `${renderReport.averageRenderReadinessScore}/100 render readiness`
                : "awaiting render check",
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
            throw new VideoGenerationHealthMonitorEngineError("Video Generation Health Monitor not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=video-generation-health-monitor-engine.js.map