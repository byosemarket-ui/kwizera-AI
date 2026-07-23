import fs from "node:fs";
import path from "node:path";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import {
  ProductIntelligenceAccessPermission,
  ProductIntelligenceCategory,
  ProductIntelligenceModuleStatus,
} from "../product-intelligence-foundation/types.js";
import { ProductIntelligenceAutoRepairHandler } from "./auto-repair-handler.js";
import { ProductIntelligenceEarlyWarningSystem } from "./early-warning-system.js";
import { ProductIntelligenceHealthCheckRunner } from "./health-check-runner.js";
import { ProductIntelligenceHealthMonitorLogger } from "./health-logger.js";
import {
  ProductIntelligenceHealthHistoryStore,
  ProductIntelligenceTrendAnalyzer,
} from "./health-history-store.js";
import { ProductIntelligenceHealthReportGenerator } from "./health-report-generator.js";
import { ProductIntelligenceAuditor } from "./product-intelligence-auditor.js";
import { ProductIntelligenceModuleHealthChecker } from "./module-health-checker.js";
import { ProductIntelligenceResourceMonitor } from "./resource-monitor.js";
import {
  MonitoredProductIntelligenceModuleHealthScore,
  ProductIntelligenceAuditResult,
  ProductIntelligenceHealthCheckResult,
  ProductIntelligenceHealthHistoryEntry,
  ProductIntelligenceHealthMonitorEngineError,
  ProductIntelligenceHealthMonitorStatusReport,
  ProductIntelligenceHealthScoreLevel,
  ProductIntelligenceTrendAnalysis,
} from "./types.js";

/**
 * Product Intelligence Health Monitor — continuously monitors health, integrity,
 * quality, availability and performance of the entire Product Intelligence System.
 */
export class AiProductIntelligenceHealthMonitorEngine {
  private foundation: AiProductIntelligenceFoundation | null = null;
  private storageRoot = "";
  private healthDir = "";
  private projectStateDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new ProductIntelligenceHealthMonitorLogger();
  readonly history = new ProductIntelligenceHealthHistoryStore();

  private moduleChecker: ProductIntelligenceModuleHealthChecker | null = null;
  private resourceMonitor: ProductIntelligenceResourceMonitor | null = null;
  private earlyWarning: ProductIntelligenceEarlyWarningSystem | null = null;
  private autoRepair: ProductIntelligenceAutoRepairHandler | null = null;
  private checkRunner: ProductIntelligenceHealthCheckRunner | null = null;
  private auditor: ProductIntelligenceAuditor | null = null;
  private reportGenerator: ProductIntelligenceHealthReportGenerator | null = null;
  private trendAnalyzer = new ProductIntelligenceTrendAnalyzer();

  private lastCheck: ProductIntelligenceHealthCheckResult | null = null;
  private lastAudit: ProductIntelligenceAuditResult | null = null;
  private checkTimes: number[] = [];
  private totalWarnings = 0;

  initialize(
    foundation: AiProductIntelligenceFoundation,
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

    this.moduleChecker = new ProductIntelligenceModuleHealthChecker(foundation);
    this.resourceMonitor = new ProductIntelligenceResourceMonitor(foundation, storageRoot);
    this.earlyWarning = new ProductIntelligenceEarlyWarningSystem(foundation);
    this.autoRepair = new ProductIntelligenceAutoRepairHandler(foundation, this.logger);
    this.checkRunner = new ProductIntelligenceHealthCheckRunner(
      foundation,
      this.moduleChecker,
      this.resourceMonitor,
      this.earlyWarning,
      this.autoRepair,
      this.history,
      this.logger
    );
    this.auditor = new ProductIntelligenceAuditor(foundation, storageRoot, this.logger);
    this.reportGenerator = new ProductIntelligenceHealthReportGenerator(this.projectStateDir);

    fs.mkdirSync(this.healthDir, { recursive: true });
    this.initialized = true;
    this.logger.log("info", "startup", "Product Intelligence Health Monitor initialized", {
      healthDir: this.healthDir,
    });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    this.foundation!.registerProductIntelligenceModule({
      moduleId: "product-intelligence-health-monitor",
      moduleName: "Product Intelligence Health Monitor",
      category: ProductIntelligenceCategory.HealthMonitoring,
      version: "0.1.0",
      status: ProductIntelligenceModuleStatus.Active,
      dependencies: [
        "product-engine",
        "product-analysis-engine",
        "product-understanding-engine",
        "audience-intelligence",
        "marketing-strategy-intelligence",
        "creative-direction",
        "storyboard-intelligence",
        "script-planning",
        "visual-planning",
        "audio-planning",
        "production-planning",
        "quality-prediction",
        "product-intelligence-optimization",
      ],
      qualityScore: 95,
      confidenceScore: 94,
      storageLocation: path.join(this.foundation!.getIntelligenceRoot(), "health"),
      accessPermissions: [
        ProductIntelligenceAccessPermission.Read,
        ProductIntelligenceAccessPermission.Validate,
      ],
      implemented: true,
    });

    this.lastCheck = await this.runHealthCheck();
    this.lastAudit = await this.runAudit();

    this.startupComplete = true;
    this.logger.log("info", "startup", "Product Intelligence Health Monitor startup complete", {
      overallScore: this.lastCheck.overallScore,
      overallLevel: this.lastCheck.overallLevel,
      durationMs: Date.now() - start,
    });
  }

  async runHealthCheck(): Promise<ProductIntelligenceHealthCheckResult> {
    this.ensureReady();
    const result = await this.checkRunner!.runCheck();
    this.lastCheck = result;
    this.checkTimes.push(result.performance.checkDurationMs);
    this.totalWarnings += result.warnings.length;
    return result;
  }

  async runAudit(): Promise<ProductIntelligenceAuditResult> {
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

  getModuleScores(): MonitoredProductIntelligenceModuleHealthScore[] {
    this.ensureReady();
    return this.moduleChecker!.checkAll();
  }

  getLastCheck(): ProductIntelligenceHealthCheckResult | null {
    return this.lastCheck;
  }

  getLastAudit(): ProductIntelligenceAuditResult | null {
    return this.lastAudit;
  }

  getHealthHistory(): ProductIntelligenceHealthHistoryEntry[] {
    return this.history.getAll();
  }

  getTrendAnalysis(): ProductIntelligenceTrendAnalysis {
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

  buildStatusReport(): ProductIntelligenceHealthMonitorStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;
    if (this.lastCheck && this.lastCheck.overallLevel === ProductIntelligenceHealthScoreLevel.Critical) {
      readinessScore -= 20;
    }
    if (this.lastAudit && !this.lastAudit.valid) readinessScore -= 15;

    const trend = this.getTrendAnalysis();
    const moduleScores = this.lastCheck?.moduleScores ?? [];
    const excellent = moduleScores.filter(
      (m) => m.level === ProductIntelligenceHealthScoreLevel.Excellent
    ).length;
    const recommendations = this.lastCheck?.recommendations ?? [];

    const relationshipModule = moduleScores.find((m) => m.module === "product-relationships");
    const planningModules = moduleScores.filter((m) =>
      ["script-planning", "visual-planning", "audio-planning", "production-planning"].includes(
        m.module
      )
    );
    const planningAvg =
      planningModules.length > 0
        ? Math.round(planningModules.reduce((s, m) => s + m.score, 0) / planningModules.length)
        : 100;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      overallProductIntelligenceHealth: this.lastCheck
        ? `${this.lastCheck.overallLevel} (${this.lastCheck.overallScore}/100)`
        : "awaiting first check",
      moduleHealthSummary: `${excellent}/${moduleScores.length} modules excellent`,
      planningQuality: `${planningAvg}/100 average planning module health`,
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
      throw new ProductIntelligenceHealthMonitorEngineError(
        "Product Intelligence Health Monitor not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
