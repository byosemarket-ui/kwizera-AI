import crypto from "node:crypto";
import { VideoGenerationHealthScoreLevel, MonitoredVideoGenerationModule, } from "./types.js";
export class VideoGenerationHealthCheckRunner {
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
        const checkId = `vg-hc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
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
        if (overallLevel === VideoGenerationHealthScoreLevel.Critical ||
            overallLevel === VideoGenerationHealthScoreLevel.Failed ||
            warnings.length > 3) {
            const repairResult = await this.autoRepair.attemptRepairs(warnings);
            repairs = repairResult.repairs;
            recoveryNotified = repairResult.repairs.some((r) => r.includes("notified"));
        }
        else if (warnings.length > 0) {
            repairs.push("Diagnostics collected");
            if (recommendations.length === 0) {
                recommendations.push("Review video generation module warnings");
            }
        }
        const optimizationStatus = this.foundation.getVideoGenerationOptimizationEngine().buildStatusReport().readinessScore >= 75;
        const storyModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.StoryboardGeneration);
        const sceneModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.SceneGeneration);
        const cameraModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.CameraDirector);
        const motionModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.MotionGeneration);
        const animationModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.Animation);
        const vfxModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.VisualEffects);
        const audioModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.AudioSynchronization);
        const marketingModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.MarketingVideo);
        const productionModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.VideoProduction);
        const renderModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.RenderingPreparation);
        const validationModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.VideoQualityValidation);
        const assetModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.AssetRegistry);
        const timelineModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.TimelineRegistry);
        const registryModule = moduleScores.find((m) => m.module === MonitoredVideoGenerationModule.ProductionRegistry);
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
                validationPerformanceMs: metrics.validationPerformanceMs,
                optimizationPerformanceMs: metrics.optimizationPerformanceMs,
                diskUsageMb: metrics.diskUsageMb,
                memoryUsageMb: metrics.memoryUsageMb,
                cpuUsagePercent: metrics.cpuUsagePercent,
                gpuUsagePercent: metrics.gpuUsagePercent,
            },
            storyboardIntegrity: (storyModule?.score ?? 70) >= 60,
            sceneIntegrity: (sceneModule?.score ?? 70) >= 60,
            timelineIntegrity: (timelineModule?.score ?? 70) >= 60,
            cameraIntegrity: (cameraModule?.score ?? 70) >= 60,
            motionIntegrity: (motionModule?.score ?? 70) >= 60,
            animationIntegrity: (animationModule?.score ?? 70) >= 60,
            visualEffectsIntegrity: (vfxModule?.score ?? 70) >= 60,
            audioIntegrity: (audioModule?.score ?? 70) >= 60,
            marketingIntegrity: (marketingModule?.score ?? 70) >= 60,
            productionIntegrity: (productionModule?.score ?? 70) >= 60,
            renderPreparationIntegrity: (renderModule?.score ?? 70) >= 60,
            validationIntegrity: (validationModule?.score ?? 70) >= 60,
            assetIntegrity: (assetModule?.score ?? 70) >= 60,
            registryIntegrity: (registryModule?.score ?? 70) >= 60,
            optimizationStatus,
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
        this.logger.log("info", "health-check", "Video generation health check complete", {
            checkId,
            overallScore,
            overallLevel,
            warnings: warnings.length,
        });
        return result;
    }
}
//# sourceMappingURL=health-check-runner.js.map