import crypto from "node:crypto";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { AutoRepairHandler } from "./auto-repair-handler.js";
import { EarlyWarningSystem } from "./early-warning-system.js";
import { MemoryHealthMonitorLogger } from "./health-logger.js";
import { HealthHistoryStore } from "./health-history-store.js";
import { ModuleHealthChecker } from "./module-health-checker.js";
import { ResourceMonitor } from "./resource-monitor.js";
import {
  MemoryHealthCheckResult,
  HealthHistoryEntry,
  MemoryHealthScoreLevel,
} from "./types.js";

export class HealthCheckRunner {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly moduleChecker: ModuleHealthChecker,
    private readonly resourceMonitor: ResourceMonitor,
    private readonly earlyWarning: EarlyWarningSystem,
    private readonly autoRepair: AutoRepairHandler,
    private readonly history: HealthHistoryStore,
    private readonly logger: MemoryHealthMonitorLogger
  ) {}

  async runCheck(): Promise<MemoryHealthCheckResult> {
    const start = Date.now();
    const checkId = `hc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

    const moduleScores = this.moduleChecker.checkAll();
    const metrics = this.resourceMonitor.measure();
    const warnings = await this.earlyWarning.detect(moduleScores, metrics);

    const overallScore = moduleScores.length > 0
      ? Math.round(moduleScores.reduce((s, m) => s + m.score, 0) / moduleScores.length)
      : 100;

    const overallLevel = this.moduleChecker.scoreToLevel(overallScore);
    const errors: string[] = [];
    const recommendations = warnings.map((w) => w.recommendation);
    let repairs: string[] = [];

    for (const mod of moduleScores) {
      if (!mod.available) errors.push(`${mod.module} unavailable`);
      errors.push(...mod.issues);
    }

    if (overallLevel === MemoryHealthScoreLevel.Critical || overallLevel === MemoryHealthScoreLevel.Failed || warnings.length > 3) {
      const repairResult = await this.autoRepair.attemptRepairs(warnings);
      repairs = repairResult.repairs;
    }

    const backupReadiness = this.foundation.getMemoryBackupEngine().buildStatusReport().totalBackups > 0;
    const recoveryReadiness = this.foundation.getMemoryRecoveryEngine().buildStatusReport().readinessScore >= 75;

    const result: MemoryHealthCheckResult = {
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

    const historyEntry: HealthHistoryEntry = {
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
