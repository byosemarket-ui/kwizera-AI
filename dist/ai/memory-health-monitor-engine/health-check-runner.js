import crypto from "node:crypto";
import { MemoryHealthScoreLevel, } from "./types.js";
export class HealthCheckRunner {
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
        const checkId = `hc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
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
        for (const mod of moduleScores) {
            if (!mod.available)
                errors.push(`${mod.module} unavailable`);
            errors.push(...mod.issues);
        }
        if (overallLevel === MemoryHealthScoreLevel.Critical || overallLevel === MemoryHealthScoreLevel.Failed || warnings.length > 3) {
            const repairResult = await this.autoRepair.attemptRepairs(warnings);
            repairs = repairResult.repairs;
        }
        const backupReadiness = this.foundation.getMemoryBackupEngine().buildStatusReport().totalBackups > 0;
        const recoveryReadiness = this.foundation.getMemoryRecoveryEngine().buildStatusReport().readinessScore >= 75;
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
                readPerformanceMs: metrics.readPerformanceMs,
                writePerformanceMs: metrics.writePerformanceMs,
                searchPerformanceMs: metrics.searchPerformanceMs,
                retrievalPerformanceMs: metrics.retrievalPerformanceMs,
                diskUsageMb: metrics.diskUsageMb,
                memoryUsageMb: metrics.memoryUsageMb,
            },
            backupReadiness,
            recoveryReadiness,
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
        this.logger.log("info", "health-check", "Health check complete", {
            checkId,
            overallScore,
            overallLevel,
            warnings: warnings.length,
        });
        return result;
    }
}
//# sourceMappingURL=health-check-runner.js.map