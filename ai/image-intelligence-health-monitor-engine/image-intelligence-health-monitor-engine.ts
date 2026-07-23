import fs from "node:fs";
import path from "node:path";
import type { AiImageIntelligenceFoundation } from "../image-intelligence-foundation/image-intelligence-foundation.js";
import {
  ImageIntelligenceAccessPermission,
  ImageIntelligenceCategory,
  ImageIntelligenceModuleStatus,
} from "../image-intelligence-foundation/types.js";
import { ImageIntelligenceAutoRepairHandler } from "./auto-repair-handler.js";
import { ImageIntelligenceEarlyWarningSystem } from "./early-warning-system.js";
import { ImageIntelligenceHealthCheckRunner } from "./health-check-runner.js";
import { ImageIntelligenceHealthMonitorLogger } from "./health-logger.js";
import {
  ImageIntelligenceHealthHistoryStore,
  ImageIntelligenceTrendAnalyzer,
} from "./health-history-store.js";
import { ImageIntelligenceHealthReportGenerator } from "./health-report-generator.js";
import { ImageIntelligenceAuditor } from "./image-intelligence-auditor.js";
import { ImageIntelligenceModuleHealthChecker } from "./module-health-checker.js";
import { ImageIntelligenceResourceMonitor } from "./resource-monitor.js";
import {
  ImageIntelligenceAuditResult,
  ImageIntelligenceHealthCheckResult,
  ImageIntelligenceHealthHistoryEntry,
  ImageIntelligenceHealthMonitorEngineError,
  ImageIntelligenceHealthMonitorStatusReport,
  ImageIntelligenceHealthScoreLevel,
  MonitoredImageIntelligenceModule,
  MonitoredImageIntelligenceModuleHealthScore,
} from "./types.js";

/**
 * Image Intelligence Health Monitor — continuously monitors health, integrity,
 * quality, availability and performance of the entire Image Intelligence System.
 */
export class AiImageIntelligenceHealthMonitorEngine {
  private foundation: AiImageIntelligenceFoundation | null = null;
  private storageRoot = "";
  private healthDir = "";
  private projectStateDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new ImageIntelligenceHealthMonitorLogger();
  readonly history = new ImageIntelligenceHealthHistoryStore();

  private moduleChecker: ImageIntelligenceModuleHealthChecker | null = null;
  private resourceMonitor: ImageIntelligenceResourceMonitor | null = null;
  private earlyWarning: ImageIntelligenceEarlyWarningSystem | null = null;
  private autoRepair: ImageIntelligenceAutoRepairHandler | null = null;
  private checkRunner: ImageIntelligenceHealthCheckRunner | null = null;
  private auditor: ImageIntelligenceAuditor | null = null;
  private reportGenerator: ImageIntelligenceHealthReportGenerator | null = null;
  private trendAnalyzer = new ImageIntelligenceTrendAnalyzer();

  private lastCheck: ImageIntelligenceHealthCheckResult | null = null;
  private lastAudit: ImageIntelligenceAuditResult | null = null;
  private checkTimes: number[] = [];
  private totalWarnings = 0;

  initialize(
    foundation: AiImageIntelligenceFoundation,
    storageRoot: string,
    projectStateDir?: string
  ): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;
    this.healthDir = path.join(foundation.getIntelligenceRoot(), "health", "engine");
    this.projectStateDir = projectStateDir ?? path.join(storageRoot, "project-state");

    const logDir = path.join(storageRoot, "logs");
    this.logger.initialize(logDir);
    this.history.initialize(this.healthDir);

    this.moduleChecker = new ImageIntelligenceModuleHealthChecker(foundation);
    this.resourceMonitor = new ImageIntelligenceResourceMonitor(foundation, storageRoot);
    this.earlyWarning = new ImageIntelligenceEarlyWarningSystem(foundation);
    this.autoRepair = new ImageIntelligenceAutoRepairHandler(foundation, this.logger);
    this.checkRunner = new ImageIntelligenceHealthCheckRunner(
      foundation,
      this.moduleChecker,
      this.resourceMonitor,
      this.earlyWarning,
      this.autoRepair,
      this.history,
      this.logger
    );
    this.auditor = new ImageIntelligenceAuditor(foundation, storageRoot, this.logger);
    this.reportGenerator = new ImageIntelligenceHealthReportGenerator(this.projectStateDir);

    fs.mkdirSync(this.healthDir, { recursive: true });
    this.initialized = true;
    this.logger.log("info", "startup", "Image Intelligence Health Monitor initialized", {
      healthDir: this.healthDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    this.foundation!.registerImageIntelligenceModule({
      moduleId: "image-intelligence-health-monitor",
      moduleName: "Image Intelligence Health Monitor",
      category: ImageIntelligenceCategory.HealthMonitoring,
      version: "0.1.0",
      status: ImageIntelligenceModuleStatus.Active,
      dependencies: [
        "image-engine",
        "image-analysis-engine",
        "image-understanding-engine",
        "object-detection-intelligence",
        "background-intelligence",
        "composition-intelligence",
        "lighting-color-intelligence",
        "brand-visual-intelligence",
        "image-enhancement-planning",
        "creative-image-intelligence",
        "production-image-planning",
        "image-quality-prediction",
        "image-intelligence-optimization",
      ],
      qualityScore: 95,
      confidenceScore: 94,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "health"),
      accessPermissions: [
        ImageIntelligenceAccessPermission.Read,
        ImageIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.lastCheck = await this.runHealthCheck();
    this.lastAudit = await this.runAudit();

    this.startupComplete = true;
    this.logger.log("info", "startup", "Image Intelligence Health Monitor startup complete", {
      overallScore: this.lastCheck.overallScore,
      overallLevel: this.lastCheck.overallLevel,
      durationMs: Date.now() - start,
    });
  }

  async runHealthCheck(): Promise<ImageIntelligenceHealthCheckResult> {
    this.ensureReady();
    const result = await this.checkRunner!.runCheck();
    this.lastCheck = result;
    this.checkTimes.push(result.performance.checkDurationMs);
    this.totalWarnings += result.warnings.length;
    return result;
  }

  async runAudit(): Promise<ImageIntelligenceAuditResult> {
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

  getModuleScores(): MonitoredImageIntelligenceModuleHealthScore[] {
    this.ensureReady();
    return this.moduleChecker!.checkAll();
  }

  getLastCheck(): ImageIntelligenceHealthCheckResult | null {
    return this.lastCheck;
  }

  getLastAudit(): ImageIntelligenceAuditResult | null {
    return this.lastAudit;
  }

  getHealthHistory(): ImageIntelligenceHealthHistoryEntry[] {
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

  buildStatusReport(): ImageIntelligenceHealthMonitorStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (this.lastCheck && this.lastCheck.overallLevel === ImageIntelligenceHealthScoreLevel.Critical) {
      readinessScore -= 20;
    }
    if (this.lastAudit && !this.lastAudit.valid) readinessScore -= 15;

    const trend = this.getTrendAnalysis();
    const moduleScores = this.lastCheck?.moduleScores ?? [];
    const excellent = moduleScores.filter(
      (m) => m.level === ImageIntelligenceHealthScoreLevel.Excellent
    ).length;
    const recommendations = this.lastCheck?.recommendations ?? [];

    const relationshipModule = moduleScores.find(
      (m) => m.module === MonitoredImageIntelligenceModule.ImageRelationships
    );
    const qpReport = this.foundation?.getImageQualityPredictionEngine().buildStatusReport();
    const planningModules = moduleScores.filter((m) =>
      [
        MonitoredImageIntelligenceModule.ImageEnhancementPlanning,
        MonitoredImageIntelligenceModule.CreativeImageIntelligence,
        MonitoredImageIntelligenceModule.ProductionImagePlanning,
      ].includes(m.module)
    );
    const planningAvg =
      planningModules.length > 0
        ? Math.round(planningModules.reduce((s, m) => s + m.score, 0) / planningModules.length)
        : 100;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      overallImageIntelligenceHealth: this.lastCheck
        ? `${this.lastCheck.overallLevel} (${this.lastCheck.overallScore}/100)`
        : "awaiting first check",
      moduleHealthSummary: `${excellent}/${moduleScores.length} modules excellent`,
      imageQuality: qpReport
        ? `${qpReport.averageOverallQualityScore}/100 average image quality`
        : "awaiting quality prediction data",
      relationshipHealth: relationshipModule
        ? `${relationshipModule.score}/100 (${relationshipModule.level})`
        : "awaiting relationship check",
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
      throw new ImageIntelligenceHealthMonitorEngineError(
        "Image Intelligence Health Monitor not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
