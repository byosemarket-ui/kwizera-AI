import crypto from "node:crypto";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import { ImageIntelligenceAutoRepairHandler } from "./auto-repair-handler.js";
import { ImageIntelligenceEarlyWarningSystem } from "./early-warning-system.js";
import { ImageIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { ImageIntelligenceHealthHistoryStore } from "./health-history-store.js";
import { ImageIntelligenceModuleHealthChecker } from "./module-health-checker.js";
import { ImageIntelligenceResourceMonitor } from "./resource-monitor.js";
import {
  ImageIntelligenceHealthCheckResult,
  ImageIntelligenceHealthHistoryEntry,
  ImageIntelligenceHealthScoreLevel,
  MonitoredImageIntelligenceModule,
} from "./types.js";

export class ImageIntelligenceHealthCheckRunner {
  constructor(
    private readonly foundation: AiImageIntelligenceFoundation,
    private readonly moduleChecker: ImageIntelligenceModuleHealthChecker,
    private readonly resourceMonitor: ImageIntelligenceResourceMonitor,
    private readonly earlyWarning: ImageIntelligenceEarlyWarningSystem,
    private readonly autoRepair: ImageIntelligenceAutoRepairHandler,
    private readonly history: ImageIntelligenceHealthHistoryStore,
    private readonly logger: ImageIntelligenceHealthMonitorLogger
  ) {}

  async runCheck(): Promise<ImageIntelligenceHealthCheckResult> {
    const start = Date.now();
    const checkId = `ii-hc-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

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
      overallLevel === ImageIntelligenceHealthScoreLevel.Critical ||
      overallLevel === ImageIntelligenceHealthScoreLevel.Failed ||
      warnings.length > 3
    ) {
      const repairResult = await this.autoRepair.attemptRepairs(warnings);
      repairs = repairResult.repairs;
      recoveryNotified = repairResult.repairs.some((r) => r.includes("notified"));
    }

    const optimizationStatus =
      this.foundation.getImageIntelligenceOptimizationEngine().buildStatusReport().readinessScore >= 75;
    const qualityPredictionStatus =
      this.foundation.getImageQualityPredictionEngine().buildStatusReport().readinessScore >= 75;

    const relationshipModule = moduleScores.find(
      (m) => m.module === MonitoredImageIntelligenceModule.ImageRelationships
    );
    const planningModules = moduleScores.filter((m) =>
      [
        MonitoredImageIntelligenceModule.ImageEnhancementPlanning,
        MonitoredImageIntelligenceModule.CreativeImageIntelligence,
        MonitoredImageIntelligenceModule.ProductionImagePlanning,
      ].includes(m.module)
    );
    const qpReport = this.foundation.getImageQualityPredictionEngine().buildStatusReport();
    const imageQualityIntegrity =
      qpReport.readinessScore >= 75 &&
      (qpReport.predictionsCreated === 0 || qpReport.averageOverallQualityScore >= 55);
    const planningIntegrity =
      planningModules.length === 0 || planningModules.every((m) => m.score >= 60 && m.available);
    const relationshipIntegrity = (relationshipModule?.score ?? 70) >= 60;

    const result: ImageIntelligenceHealthCheckResult = {
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
      imageQualityIntegrity,
      planningIntegrity,
      relationshipIntegrity,
      optimizationStatus,
      qualityPredictionStatus,
      recoveryNotified,
    };

    const historyEntry: ImageIntelligenceHealthHistoryEntry = {
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

    this.logger.log("info", "health-check", "Image intelligence health check complete", {
      checkId,
      overallScore,
      overallLevel,
      warnings: warnings.length,
    });

    return result;
  }
}
