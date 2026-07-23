import fs from "node:fs";
import path from "node:path";
import { VideoIntelligenceAccessPermission, VideoIntelligenceCategory, VideoIntelligenceModuleStatus, } from "../video-intelligence-foundation/types.js";
import { VideoIntelligenceAutoRepairHandler } from "./auto-repair-handler.js";
import { VideoIntelligenceEarlyWarningSystem } from "./early-warning-system.js";
import { VideoIntelligenceHealthCheckRunner } from "./health-check-runner.js";
import { VideoIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { VideoIntelligenceHealthHistoryStore, VideoIntelligenceTrendAnalyzer, } from "./health-history-store.js";
import { VideoIntelligenceHealthReportGenerator } from "./health-report-generator.js";
import { VideoIntelligenceAuditor } from "./video-intelligence-auditor.js";
import { VideoIntelligenceModuleHealthChecker } from "./module-health-checker.js";
import { VideoIntelligenceResourceMonitor } from "./resource-monitor.js";
import { VideoIntelligenceHealthMonitorEngineError, VideoIntelligenceHealthScoreLevel, MonitoredVideoIntelligenceModule, } from "./types.js";
/**
 * Video Intelligence Health Monitor — continuously monitors health, integrity,
 * quality, availability and performance of the entire Video Intelligence System.
 */
export class AiVideoIntelligenceHealthMonitorEngine {
    foundation = null;
    storageRoot = "";
    healthDir = "";
    projectStateDir = "";
    initialized = false;
    startupComplete = false;
    logger = new VideoIntelligenceHealthMonitorLogger();
    history = new VideoIntelligenceHealthHistoryStore();
    moduleChecker = null;
    resourceMonitor = null;
    earlyWarning = null;
    autoRepair = null;
    checkRunner = null;
    auditor = null;
    reportGenerator = null;
    trendAnalyzer = new VideoIntelligenceTrendAnalyzer();
    lastCheck = null;
    lastAudit = null;
    checkTimes = [];
    totalWarnings = 0;
    initialize(foundation, storageRoot, projectStateDir) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.healthDir = path.join(foundation.getIntelligenceRoot(), "health", "engine");
        this.projectStateDir = projectStateDir ?? path.join(storageRoot, "project-state");
        const logDir = path.join(storageRoot, "logs");
        this.logger.initialize(logDir);
        this.history.initialize(this.healthDir);
        this.moduleChecker = new VideoIntelligenceModuleHealthChecker(foundation);
        this.resourceMonitor = new VideoIntelligenceResourceMonitor(foundation, storageRoot);
        this.earlyWarning = new VideoIntelligenceEarlyWarningSystem(foundation);
        this.autoRepair = new VideoIntelligenceAutoRepairHandler(foundation, this.logger);
        this.checkRunner = new VideoIntelligenceHealthCheckRunner(foundation, this.moduleChecker, this.resourceMonitor, this.earlyWarning, this.autoRepair, this.history, this.logger);
        this.auditor = new VideoIntelligenceAuditor(foundation, storageRoot, this.logger);
        this.reportGenerator = new VideoIntelligenceHealthReportGenerator(this.projectStateDir);
        fs.mkdirSync(this.healthDir, { recursive: true });
        this.initialized = true;
        this.logger.log("info", "startup", "Video Intelligence Health Monitor initialized", {
            healthDir: this.healthDir,
        });
    }
    async runStartup() {
        this.ensureReady();
        const start = Date.now();
        this.foundation.registerVideoIntelligenceModule({
            moduleId: "video-intelligence-health-monitor",
            moduleName: "Video Intelligence Health Monitor",
            category: VideoIntelligenceCategory.HealthMonitoring,
            version: "0.1.0",
            status: VideoIntelligenceModuleStatus.Active,
            dependencies: [
                "video-engine",
                "video-analysis-engine",
                "video-understanding-engine",
                "scene-intelligence",
                "timeline-intelligence",
                "camera-intelligence",
                "motion-intelligence",
                "video-style-intelligence",
                "video-enhancement-planning",
                "creative-video-intelligence",
                "production-video-planning",
                "video-quality-prediction",
                "video-intelligence-optimization",
            ],
            qualityScore: 95,
            confidenceScore: 94,
            storageLocation: path.join(this.foundation.getIntelligenceRoot(), "health"),
            accessPermissions: [
                VideoIntelligenceAccessPermission.Read,
                VideoIntelligenceAccessPermission.Validate,
            ],
            implemented: true,
        });
        this.lastCheck = await this.runHealthCheck();
        this.lastAudit = await this.runAudit();
        this.startupComplete = true;
        this.logger.log("info", "startup", "Video Intelligence Health Monitor startup complete", {
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
        if (this.lastCheck && this.lastCheck.overallLevel === VideoIntelligenceHealthScoreLevel.Critical) {
            readinessScore -= 20;
        }
        if (this.lastAudit && !this.lastAudit.valid)
            readinessScore -= 15;
        const trend = this.getTrendAnalysis();
        const moduleScores = this.lastCheck?.moduleScores ?? [];
        const excellent = moduleScores.filter((m) => m.level === VideoIntelligenceHealthScoreLevel.Excellent).length;
        const recommendations = this.lastCheck?.recommendations ?? [];
        const relationshipModule = moduleScores.find((m) => m.module === MonitoredVideoIntelligenceModule.VideoRelationships);
        const timelineModule = moduleScores.find((m) => m.module === MonitoredVideoIntelligenceModule.TimelineIntelligence);
        const qpReport = this.foundation?.getVideoQualityPredictionEngine().buildStatusReport();
        const understandingReport = this.foundation?.getVideoUnderstandingEngine().buildStatusReport();
        return {
            engineStatus: this.startupComplete ? "operational" : "initializing",
            overallVideoIntelligenceHealth: this.lastCheck
                ? `${this.lastCheck.overallLevel} (${this.lastCheck.overallScore}/100)`
                : "awaiting first check",
            moduleHealthSummary: `${excellent}/${moduleScores.length} modules excellent`,
            videoQuality: qpReport
                ? `${qpReport.averageOverallQualityScore}/100 average video quality`
                : "awaiting quality prediction data",
            storytellingHealth: understandingReport
                ? `${understandingReport.averageUnderstandingScore}/100 storytelling understanding`
                : "awaiting understanding data",
            timelineHealth: timelineModule
                ? `${timelineModule.score}/100 (${timelineModule.level})`
                : "awaiting timeline check",
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
            throw new VideoIntelligenceHealthMonitorEngineError("Video Intelligence Health Monitor not initialized", "NOT_INITIALIZED");
        }
    }
}
//# sourceMappingURL=video-intelligence-health-monitor-engine.js.map