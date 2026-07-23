import crypto from "node:crypto";
import { VideoIntelligenceHealthScoreLevel, MonitoredVideoIntelligenceModule, } from "./types.js";
export class VideoIntelligenceHealthCheckRunner {
    foundation;
    moduleChecker;
    resourceMonitor;
    earlyWarning;
    autoRepair;
    history;
    logger;
    constructor(foundation, moduleChecker, resourceMonitor, earlyWarning, autoRepair, history, logger) {
        this.foundation = foundation;
        this.moduleChecker = moduleChecker;
        this.resourceMonitor = resourceMonitor;
        this.earlyWarning = earlyWarning;
        this.autoRepair = autoRepair;
        this.history = history;
        this.logger = logger;
    }
    async runCheck() {
        const start = Date.now();
        const checkId = `vi-hc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
        const moduleScores = this.moduleChecker.checkAll();
        const metrics = this.resourceMonitor.measure();
        const warnings = await this.earlyWarning.detect(moduleScores, metrics);
        const overallScore = moduleScores.length > 0
            ? Math.round(moduleScores.reduce((s, m) => s + m.score, 0) / moduleScores.length)
            : 100;
        const overallLevel = this.moduleChecker.scoreToLevel(overallScore);
        const errors = [];
        const recommendations = warnings.map((w) => w.recommendation);
        let repairs = [];
        let recoveryNotified = false;
        for (const mod of moduleScores) {
            if (!mod.available)
                errors.push(`${mod.module} unavailable`);
            errors.push(...mod.issues);
        }
        if (overallLevel === VideoIntelligenceHealthScoreLevel.Critical ||
            overallLevel === VideoIntelligenceHealthScoreLevel.Failed ||
            warnings.length > 3) {
            const repairResult = await this.autoRepair.attemptRepairs(warnings);
            repairs = repairResult.repairs;
            recoveryNotified = repairResult.repairs.some((r) => r.includes("notified"));
        }
        else if (warnings.length > 0) {
            repairs.push("Diagnostics collected");
            if (recommendations.length === 0) {
                recommendations.push("Review video intelligence module warnings");
            }
        }
        const optimizationStatus = this.foundation.getVideoIntelligenceOptimizationEngine().buildStatusReport().readinessScore >= 75;
        const qualityPredictionStatus = this.foundation.getVideoQualityPredictionEngine().buildStatusReport().readinessScore >= 75;
        const relationshipModule = moduleScores.find((m) => m.module === MonitoredVideoIntelligenceModule.VideoRelationships);
        const timelineModule = moduleScores.find((m) => m.module === MonitoredVideoIntelligenceModule.TimelineIntelligence);
        const sceneModule = moduleScores.find((m) => m.module === MonitoredVideoIntelligenceModule.SceneDetection);
        const planningModules = moduleScores.filter((m) => [
            MonitoredVideoIntelligenceModule.VideoEnhancementPlanning,
            MonitoredVideoIntelligenceModule.CreativeVideoIntelligence,
            MonitoredVideoIntelligenceModule.ProductionVideoPlanning,
        ].includes(m.module));
        const qpReport = this.foundation.getVideoQualityPredictionEngine().buildStatusReport();
        const understandingReport = this.foundation.getVideoUnderstandingEngine().buildStatusReport();
        const videoQualityIntegrity = qpReport.readinessScore >= 75 &&
            (qpReport.predictionsCreated === 0 || qpReport.averageOverallQualityScore >= 55);
        const storytellingIntegrity = understandingReport.readinessScore >= 75 &&
            (understandingReport.averageUnderstandingScore === 0 ||
                understandingReport.averageUnderstandingScore >= 55);
        const timelineIntegrity = (timelineModule?.score ?? 70) >= 60;
        const sceneIntegrity = (sceneModule?.score ?? 70) >= 60;
        const planningIntegrity = planningModules.length === 0 || planningModules.every((m) => m.score >= 60 && m.available);
        const relationshipIntegrity = (relationshipModule?.score ?? 70) >= 60;
        const result = {
            checkId,
            timestamp: new Date().toISOString(),
            overallScore,
            overallLevel,
            moduleScores,
            warnings,
            errors: [...new Set(errors)].filter(Boolean),
            repairs,
            recommendations: [...new Set(recommendations)],
            performance: {
                checkDurationMs: Date.now() - start,
                searchPerformanceMs: metrics.searchPerformanceMs,
                planningPerformanceMs: metrics.planningPerformanceMs,
                timelineProcessingMs: metrics.timelineProcessingMs,
                analysisPerformanceMs: metrics.analysisPerformanceMs,
                diskUsageMb: metrics.diskUsageMb,
                memoryUsageMb: metrics.memoryUsageMb,
                cpuUsagePercent: metrics.cpuUsagePercent,
                gpuUsagePercent: metrics.gpuUsagePercent,
            },
            videoQualityIntegrity,
            storytellingIntegrity,
            timelineIntegrity,
            sceneIntegrity,
            relationshipIntegrity,
            optimizationStatus,
            qualityPredictionStatus,
            recoveryNotified,
        };
        const historyEntry = {
            checkId,
            timestamp: result.timestamp,
            module: "system",
            healthScore: overallScore,
            level: overallLevel,
            warnings: warnings.map((w) => w.message),
            errors: result.errors,
            repairs,
            recommendations: result.recommendations,
            performanceMs: result.performance.checkDurationMs,
        };
        this.history.append(historyEntry);
        this.logger.log("info", "health-check", "Video intelligence health check complete", {
            checkId,
            overallScore,
            overallLevel,
            warnings: warnings.length,
        });
        return result;
    }
}
//# sourceMappingURL=health-check-runner.js.map