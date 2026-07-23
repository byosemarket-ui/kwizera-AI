import crypto from "node:crypto";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductIntelligenceAutoRepairHandler } from "./auto-repair-handler.js";
import { ProductIntelligenceEarlyWarningSystem } from "./early-warning-system.js";
import { ProductIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { ProductIntelligenceHealthHistoryStore } from "./health-history-store.js";
import { ProductIntelligenceModuleHealthChecker } from "./module-health-checker.js";
import { ProductIntelligenceResourceMonitor } from "./resource-monitor.js";
import {
  ProductIntelligenceHealthCheckResult,
  ProductIntelligenceHealthHistoryEntry,
  ProductIntelligenceHealthScoreLevel,
} from "./types.js";

export class ProductIntelligenceHealthCheckRunner {
  constructor(
    private readonly foundation: AiProductIntelligenceFoundation,
    private readonly moduleChecker: ProductIntelligenceModuleHealthChecker,
    private readonly resourceMonitor: ProductIntelligenceResourceMonitor,
    private readonly earlyWarning: ProductIntelligenceEarlyWarningSystem,
    private readonly autoRepair: ProductIntelligenceAutoRepairHandler,
    private readonly history: ProductIntelligenceHealthHistoryStore,
    private readonly logger: ProductIntelligenceHealthMonitorLogger
  ) {}

  async runCheck(): Promise<ProductIntelligenceHealthCheckResult> {
    const start = Date.now();
    const checkId = `pi-hc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

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
      overallLevel === ProductIntelligenceHealthScoreLevel.Critical ||
      overallLevel === ProductIntelligenceHealthScoreLevel.Failed ||
      warnings.length > 3
    ) {
      const repairResult = await this.autoRepair.attemptRepairs(warnings);
      repairs = repairResult.repairs;
      recoveryNotified = repairResult.repairs.some((r) => r.includes("notified"));
    }

    const optimizationStatus =
      this.foundation.getProductIntelligenceOptimizationEngine().buildStatusReport().readinessScore >=
      75;
    const qualityPredictionStatus =
      this.foundation.getQualityPredictionEngine().buildStatusReport().readinessScore >= 75;

    const relationshipModule = moduleScores.find((m) => m.module === "product-relationships");
    const planningModules = moduleScores.filter((m) =>
      [
        "script-planning",
        "visual-planning",
        "audio-planning",
        "production-planning",
        "storyboard-intelligence",
      ].includes(m.module)
    );
    const planningIntegrity =
      planningModules.length === 0 ||
      planningModules.every((m) => m.score >= 60 && m.available);
    const relationshipIntegrity = (relationshipModule?.score ?? 70) >= 60;

    const result: ProductIntelligenceHealthCheckResult = {
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

    const historyEntry: ProductIntelligenceHealthHistoryEntry = {
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
