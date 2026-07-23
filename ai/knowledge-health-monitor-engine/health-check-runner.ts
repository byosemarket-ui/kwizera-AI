import crypto from "node:crypto";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeAutoRepairHandler } from "./auto-repair-handler.js";
import { KnowledgeEarlyWarningSystem } from "./early-warning-system.js";
import { KnowledgeHealthMonitorLogger } from "./health-logger.js";
import { KnowledgeHealthHistoryStore } from "./health-history-store.js";
import { KnowledgeModuleHealthChecker } from "./module-health-checker.js";
import { KnowledgeResourceMonitor } from "./resource-monitor.js";
import {
  KnowledgeHealthCheckResult,
  KnowledgeHealthHistoryEntry,
  KnowledgeHealthScoreLevel,
} from "./types.js";

export class KnowledgeHealthCheckRunner {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly moduleChecker: KnowledgeModuleHealthChecker,
    private readonly resourceMonitor: KnowledgeResourceMonitor,
    private readonly earlyWarning: KnowledgeEarlyWarningSystem,
    private readonly autoRepair: KnowledgeAutoRepairHandler,
    private readonly history: KnowledgeHealthHistoryStore,
    private readonly logger: KnowledgeHealthMonitorLogger
  ) {}

  async runCheck(): Promise<KnowledgeHealthCheckResult> {
    const start = Date.now();
    const checkId = `hc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

    const moduleScores = this.moduleChecker.checkAll();
    const metrics = this.resourceMonitor.measure();
    const warnings = await this.earlyWarning.detect(moduleScores, metrics);

    const overallScore =
      moduleScores.length > 0
        ? Math.round(moduleScores.reduce((s, m) => s + m.score, 0) / moduleScores.length)
        : 100;

    const overallLevel = this.moduleChecker.scoreToLevel(overallScore);
    const errors: string[] = [];
    const recommendations = warnings.map((w) => w.recommendation);
    let repairs: string[] = [];
    let recoveryNotified = false;

    for (const mod of moduleScores) {
      if (!mod.available) errors.push(`${mod.module} unavailable`);
      errors.push(...mod.issues);
    }

    if (
      overallLevel === KnowledgeHealthScoreLevel.Critical ||
      overallLevel === KnowledgeHealthScoreLevel.Failed ||
      warnings.length > 3
    ) {
      const repairResult = await this.autoRepair.attemptRepairs(warnings);
      repairs = repairResult.repairs;
      recoveryNotified = repairResult.repairs.some((r) => r.includes("notified"));
    }

    const validationReadiness =
      this.foundation.getKnowledgeValidationEngine().buildStatusReport().readinessScore >= 75;
    const optimizationReadiness =
      this.foundation.getKnowledgeOptimizationEngine().buildStatusReport().readinessScore >= 75;

    const result: KnowledgeHealthCheckResult = {
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
        retrievalPerformanceMs: metrics.retrievalPerformanceMs,
        validationPerformanceMs: metrics.validationPerformanceMs,
        diskUsageMb: metrics.diskUsageMb,
        memoryUsageMb: metrics.memoryUsageMb,
        cpuUsagePercent: metrics.cpuUsagePercent,
      },
      validationReadiness,
      optimizationReadiness,
      recoveryNotified,
    };

    const historyEntry: KnowledgeHealthHistoryEntry = {
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

    this.logger.log("info", "health-check", "Knowledge health check complete", {
      checkId,
      overallScore,
      overallLevel,
      warnings: warnings.length,
    });

    return result;
  }
}
