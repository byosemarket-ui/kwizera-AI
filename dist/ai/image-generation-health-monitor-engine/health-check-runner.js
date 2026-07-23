import crypto from "node:crypto";
import { ImageGenerationHealthScoreLevel, MonitoredImageGenerationModule, } from "./types.js";
export class ImageGenerationHealthCheckRunner {
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
        const checkId = `ig-hc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
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
        if (overallLevel === ImageGenerationHealthScoreLevel.Critical ||
            overallLevel === ImageGenerationHealthScoreLevel.Failed ||
            warnings.length > 3) {
            const repairResult = await this.autoRepair.attemptRepairs(warnings);
            repairs = repairResult.repairs;
            recoveryNotified = repairResult.repairs.some((r) => r.includes("notified"));
        }
        else if (warnings.length > 0) {
            repairs.push("Diagnostics collected");
            if (recommendations.length === 0) {
                recommendations.push("Review image generation module warnings");
            }
        }
        const optimizationStatus = this.foundation.getImageGenerationOptimizationEngine().buildStatusReport().readinessScore >= 75;
        const promptModule = moduleScores.find((m) => m.module === MonitoredImageGenerationModule.TextToImageGeneration);
        const imageModule = moduleScores.find((m) => m.module === MonitoredImageGenerationModule.ProductImageGeneration);
        const layerModule = moduleScores.find((m) => m.module === MonitoredImageGenerationModule.LayerRegistry);
        const maskModule = moduleScores.find((m) => m.module === MonitoredImageGenerationModule.MaskRegistry);
        const brandModule = moduleScores.find((m) => m.module === MonitoredImageGenerationModule.BrandingDesign);
        const productionModule = moduleScores.find((m) => m.module === MonitoredImageGenerationModule.ImageProduction);
        const renderModule = moduleScores.find((m) => m.module === MonitoredImageGenerationModule.ImageRenderingPreparation);
        const validationModule = moduleScores.find((m) => m.module === MonitoredImageGenerationModule.ImageQualityValidation);
        const assetModule = moduleScores.find((m) => m.module === MonitoredImageGenerationModule.AssetRegistry);
        const registryModule = moduleScores.find((m) => m.module === MonitoredImageGenerationModule.ProductionRegistry);
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
            promptIntegrity: (promptModule?.score ?? 70) >= 60,
            imageIntegrity: (imageModule?.score ?? 70) >= 60,
            layerIntegrity: (layerModule?.score ?? 70) >= 60,
            maskIntegrity: (maskModule?.score ?? 70) >= 60,
            brandIntegrity: (brandModule?.score ?? 70) >= 60,
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
        this.logger.log("info", "health-check", "Image generation health check complete", {
            checkId,
            overallScore,
            overallLevel,
            warnings: warnings.length,
        });
        return result;
    }
}
//# sourceMappingURL=health-check-runner.js.map