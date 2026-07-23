import fs from "node:fs";
import path from "node:path";
import { DEFAULT_STORAGE_ROOT } from "../../storage/paths/storage-paths.js";
import type { AiImageGenerationFoundation } from "../image-generation-foundation/image-generation-foundation.js";
import {
  ImageGenerationAccessPermission,
  ImageGenerationCategory,
  ImageGenerationModuleStatus,
} from "../image-generation-foundation/types.js";
import { ImageGenerationAutoRepairHandler } from "./auto-repair-handler.js";
import { ImageGenerationEarlyWarningSystem } from "./early-warning-system.js";
import { ImageGenerationHealthCheckRunner } from "./health-check-runner.js";
import { ImageGenerationHealthMonitorLogger } from "./health-logger.js";
import {
  ImageGenerationHealthHistoryStore,
  ImageGenerationTrendAnalyzer,
} from "./health-history-store.js";
import { ImageGenerationHealthReportGenerator } from "./health-report-generator.js";
import { ImageGenerationModuleHealthChecker } from "./module-health-checker.js";
import { ImageGenerationResourceMonitor } from "./resource-monitor.js";
import { ImageGenerationAuditor } from "./image-generation-auditor.js";
import {
  ImageGenerationAuditResult,
  ImageGenerationHealthCheckResult,
  ImageGenerationHealthHistoryEntry,
  ImageGenerationHealthMonitorEngineError,
  ImageGenerationHealthMonitorStatusReport,
  ImageGenerationHealthScoreLevel,
  MonitoredImageGenerationModuleHealthScore,
} from "./types.js";

/**
 * AI Image Generation Health Monitor — continuously monitors health, integrity,
 * quality, availability and performance of the entire AI Image Generation System.
 */
export class AiImageGenerationHealthMonitorEngine {
  private foundation: AiImageGenerationFoundation | null = null;
  private storageRoot = "";
  private healthDir = "";
  private projectStateDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new ImageGenerationHealthMonitorLogger();
  readonly history = new ImageGenerationHealthHistoryStore();

  private moduleChecker: ImageGenerationModuleHealthChecker | null = null;
  private resourceMonitor: ImageGenerationResourceMonitor | null = null;
  private earlyWarning: ImageGenerationEarlyWarningSystem | null = null;
  private autoRepair: ImageGenerationAutoRepairHandler | null = null;
  private checkRunner: ImageGenerationHealthCheckRunner | null = null;
  private auditor: ImageGenerationAuditor | null = null;
  private reportGenerator: ImageGenerationHealthReportGenerator | null = null;
  private trendAnalyzer = new ImageGenerationTrendAnalyzer();

  private lastCheck: ImageGenerationHealthCheckResult | null = null;
  private lastAudit: ImageGenerationAuditResult | null = null;
  private checkTimes: number[] = [];
  private totalWarnings = 0;

  initialize(
    foundation: AiImageGenerationFoundation,
    storageRoot: string,
    projectStateDir?: string
  ): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;
    this.healthDir = path.join(foundation.getGenerationRoot(), "health", "engine");
    this.projectStateDir =
      projectStateDir ?? path.join(DEFAULT_STORAGE_ROOT, "project-state");

    const logDir = path.join(DEFAULT_STORAGE_ROOT, "logs");
    this.logger.initialize(logDir);
    this.history.initialize(this.healthDir);

    this.moduleChecker = new ImageGenerationModuleHealthChecker(foundation);
    this.resourceMonitor = new ImageGenerationResourceMonitor(foundation, storageRoot);
    this.earlyWarning = new ImageGenerationEarlyWarningSystem(foundation);
    this.autoRepair = new ImageGenerationAutoRepairHandler(foundation, this.logger);
    this.checkRunner = new ImageGenerationHealthCheckRunner(
      foundation,
      this.moduleChecker,
      this.resourceMonitor,
      this.earlyWarning,
      this.autoRepair,
      this.history,
      this.logger
    );
    this.auditor = new ImageGenerationAuditor(foundation, storageRoot, this.logger);
    this.reportGenerator = new ImageGenerationHealthReportGenerator(this.projectStateDir);

    fs.mkdirSync(this.healthDir, { recursive: true });
    this.initialized = true;
    this.logger.log("info", "startup", "Image Generation Health Monitor initialized", {
      healthDir: this.healthDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    this.foundation!.registerImageGenerationModule({
      moduleId: "image-generation-health-monitor",
      moduleName: "Image Generation Health Monitor",
      category: ImageGenerationCategory.GenerationHealthMonitoring,
      version: "0.1.0",
      status: ImageGenerationModuleStatus.Active,
      dependencies: [
        "image-generation-engine",
        "text-to-image-generation-engine",
        "image-to-image-generation-engine",
        "product-image-generation-engine",
        "background-generation-engine",
        "image-editing-generation-engine",
        "image-enhancement-generation-engine",
        "branding-design-generation-engine",
        "multi-style-image-generation-engine",
        "image-production-engine",
        "image-rendering-preparation-engine",
        "image-quality-validation-engine",
        "image-generation-optimization-engine",
      ],
      qualityScore: 95,
      confidenceScore: 94,
      storageLocation: path.join(this.foundation!.getGenerationRoot(), "health"),
      accessPermissions: [
        ImageGenerationAccessPermission.Read,
        ImageGenerationAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.lastCheck = await this.runHealthCheck();
    this.lastAudit = await this.runAudit();

    this.startupComplete = true;
    this.logger.log("info", "startup", "Image Generation Health Monitor startup complete", {
      overallScore: this.lastCheck.overallScore,
      overallLevel: this.lastCheck.overallLevel,
      durationMs: Date.now() - start,
    });
  }

  async runHealthCheck(): Promise<ImageGenerationHealthCheckResult> {
    this.ensureReady();
    const result = await this.checkRunner!.runCheck();
    this.lastCheck = result;
    this.checkTimes.push(result.performance.checkDurationMs);
    this.totalWarnings += result.warnings.length;
    return result;
  }

  async runAudit(): Promise<ImageGenerationAuditResult> {
    this.ensureReady();
    const result = await this.auditor!.runAudit();
    this.lastAudit = result;

    if (!result.valid && this.lastCheck) {
      this.logger.log("warn", "audit", "Audit found issues — attempting repair", {
        auditId: result.auditId,
      });
      await this.autoRepair!.attemptRepairs(this.lastCheck.warnings);
      this.lastAudit = await this.auditor!.runAudit();
    }

    return this.lastAudit;
  }

  getModuleScores(): MonitoredImageGenerationModuleHealthScore[] {
    this.ensureReady();
    return this.moduleChecker!.checkAll();
  }

  getLastCheck(): ImageGenerationHealthCheckResult | null {
    return this.lastCheck;
  }

  getLastAudit(): ImageGenerationAuditResult | null {
    return this.lastAudit;
  }

  getHealthHistory(): ImageGenerationHealthHistoryEntry[] {
    return this.history.getAll();
  }

  getTrendAnalysis() {
    return this.trendAnalyzer.analyze(this.history.getAll());
  }

  generateReports(): {
    healthReportPath: string;
    historyReportPath: string;
    performanceReportPath: string;
    recommendationsReportPath: string;
  } {
    this.ensureReady();
    return this.reportGenerator!.generateAll(
      this.buildStatusReport(),
      this.lastCheck,
      this.history.getAll(),
      this.lastCheck?.moduleScores ?? this.moduleChecker!.checkAll()
    );
  }

  buildStatusReport(): ImageGenerationHealthMonitorStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (this.lastCheck && this.lastCheck.overallLevel === ImageGenerationHealthScoreLevel.Critical) {
      readinessScore -= 20;
    }
    if (this.lastAudit && !this.lastAudit.valid) readinessScore -= 15;

    const trend = this.getTrendAnalysis();
    const moduleScores = this.lastCheck?.moduleScores ?? [];
    const excellent = moduleScores.filter(
      (m) => m.level === ImageGenerationHealthScoreLevel.Excellent
    ).length;
    const recommendations = this.lastCheck?.recommendations ?? [];

    const promptReport = this.foundation?.getTextToImageGenerationEngine().buildStatusReport();
    const productionReport = this.foundation?.getImageProductionEngine().buildStatusReport();
    const renderReport = this.foundation?.getImageRenderingPreparationEngine().buildStatusReport();

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      overallImageGenerationHealth: this.lastCheck
        ? `${this.lastCheck.overallLevel} (${this.lastCheck.overallScore}/100)`
        : "awaiting first check",
      moduleHealthSummary: `${excellent}/${moduleScores.length} modules excellent`,
      promptHealth: promptReport
        ? `${promptReport.readinessScore}/100 prompt readiness (${promptReport.imagePlansGenerated} plans)`
        : "awaiting prompt check",
      productionHealth: productionReport
        ? `${productionReport.averageProductionReadinessScore}/100 production readiness`
        : "awaiting production check",
      renderReadinessHealth: renderReport
        ? `${renderReport.averageRenderReadinessScore}/100 render readiness`
        : "awaiting render check",
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

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  getHealthDir(): string {
    return this.healthDir;
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new ImageGenerationHealthMonitorEngineError(
        "Image Generation Health Monitor not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
