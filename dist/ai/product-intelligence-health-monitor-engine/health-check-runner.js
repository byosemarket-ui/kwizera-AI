import crypto from "node:crypto";
import { ProductIntelligenceHealthScoreLevel, } from "./types.js";
export class ProductIntelligenceHealthCheckRunner {
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
        const checkId = `pi-hc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
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
        if (overallLevel === ProductIntelligenceHealthScoreLevel.Critical ||
            overallLevel === ProductIntelligenceHealthScoreLevel.Failed ||
            warnings.length > 3) {
            const repairResult = await this.autoRepair.attemptRepairs(warnings);
            repairs = repairResult.repairs;
            recoveryNotified = repairResult.repairs.some((r) => r.includes("notified"));
        }
        const optimizationStatus = this.foundation.getProductIntelligenceOptimizationEngine().buildStatusReport().readinessScore >=
            75;
        const qualityPredictionStatus = this.foundation.getQualityPredictionEngine().buildStatusReport().readinessScore >= 75;
        const relationshipModule = moduleScores.find((m) => m.module === "product-relationships");
        const planningModules = moduleScores.filter((m) => [
            "script-planning",
            "visual-planning",
            "audio-planning",
            "production-planning",
            "storyboard-intelligence",
        ].includes(m.module));
        const planningIntegrity = planningModules.length === 0 ||
            planningModules.every((m) => m.score >= 60 && m.available);
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
                relationshipDetectionMs: metrics.relationshipDetectionMs,
                diskUsageMb: metrics.diskUsageMb,
                memoryUsageMb: metrics.memoryUsageMb,
                cpuUsagePercent: metrics.cpuUsagePercent,
            },
            planningIntegrity,
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
        this.logger.log("info", "health-check", "Product intelligence health check complete", {
            checkId,
            overallScore,
            overallLevel,
            warnings: warnings.length,
        });
        return result;
    }
}
//# sourceMappingURL=health-check-runner.js.map