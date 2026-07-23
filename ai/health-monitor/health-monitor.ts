import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiRecoveryEngine } from "../recovery-engine/recovery-engine.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { AlertManager } from "./alert-manager.js";
import { AutomaticActions } from "./automatic-actions.js";
import { DashboardDataBuilder } from "./dashboard-data.js";
import { HealthCheckRunner } from "./health-check-runner.js";
import { HealthHistoryStore } from "./health-history-store.js";
import { HealthMonitorLogger } from "./health-logger.js";
import { HealthScorer } from "./health-scorer.js";
import { MONITORED_COMPONENTS } from "./monitored-components.js";
import { ResourceMonitor } from "./resource-monitor.js";
import { ResponseTimeTracker } from "./response-time-tracker.js";
import {
  HealthDashboardData,
  HealthMonitorError,
  HealthMonitorStatusReport,
  HealthRecommendation,
  ModuleHealthScore,
  SystemHealthLevel,
} from "./types.js";

/**
 * AI Health Monitor — continuous health, stability, performance and availability monitoring.
 */
export class AiSystemHealthMonitor {
  private core: AiCoreManager | null = null;
  private moduleManager: AiModuleManager | null = null;
  private stateManager: AiStateManager | null = null;
  private communicationBus: AiCommunicationBus | null = null;
  private recoveryEngine: AiRecoveryEngine | null = null;
  private storageRoot = "";
  private initialized = false;

  readonly logger = new HealthMonitorLogger();
  readonly history = new HealthHistoryStore();
  private readonly scorer = new HealthScorer();
  private readonly resources = new ResourceMonitor();
  private readonly responseTimes = new ResponseTimeTracker();
  private readonly alerts = new AlertManager(this.logger);
  private readonly automaticActions = new AutomaticActions(this.logger);
  private readonly dashboardBuilder = new DashboardDataBuilder();

  private runner: HealthCheckRunner | null = null;
  private lastDashboard: HealthDashboardData | null = null;
  private lastRecommendations: HealthRecommendation[] = [];
  private scanCount = 0;
  private totalScanMs = 0;

  initialize(
    core: AiCoreManager,
    storageRoot: string,
    moduleManager?: AiModuleManager,
    stateManager?: AiStateManager,
    communicationBus?: AiCommunicationBus,
    recoveryEngine?: AiRecoveryEngine
  ): void {
    this.core = core;
    this.storageRoot = storageRoot;
    this.moduleManager = moduleManager ?? null;
    this.stateManager = stateManager ?? null;
    this.communicationBus = communicationBus ?? null;
    this.recoveryEngine = recoveryEngine ?? null;

    const logDir = path.join(storageRoot, "logs");
    const healthDir = path.join(storageRoot, "health");
    this.logger.initialize(logDir);
    this.history.initialize(healthDir);
    this.runner = new HealthCheckRunner(this.createDeps(), this.logger);
    this.initialized = true;
    this.logger.log("info", "scan", "AI Health Monitor initialized", { storageRoot });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async runHealthScan(): Promise<HealthDashboardData> {
    this.ensureReady();
    const start = Date.now();

    const checks = await this.runner!.runAll();
    const resourceUsage = this.resources.measure(this.storageRoot);

    const moduleScores: ModuleHealthScore[] = [];
    for (const def of MONITORED_COMPONENTS) {
    const moduleChecks = checks.filter(
      (c) =>
        c.name.includes(def.moduleId) ||
        (def.moduleId === "local-storage" && c.name === "storage-status") ||
        (def.moduleId === "configuration" && c.name === "configuration-status") ||
        (def.moduleId === "logs" && c.name === "logs-status") ||
        (def.moduleId === "database" && c.name === "database-status")
    );
      const responseTime =
        moduleChecks.find((c) => c.responseTimeMs !== undefined)?.responseTimeMs ?? 0;
      moduleScores.push(
        this.scorer.scoreModule(def.moduleId, def.moduleName, moduleChecks, responseTime, def.implemented)
      );
    }

    const systemScore = this.scorer.aggregateSystemScore(moduleScores);
    const systemLevel = this.scorer.scoreToLevel(systemScore);

    const warnings = moduleScores.flatMap((m) => m.warnings);
    const errors = moduleScores.flatMap((m) => m.errors);
    const moduleErrors = moduleScores
      .filter((m) => m.errors.length > 0)
      .map((m) => ({ component: m.moduleId, message: m.errors[0] }));

    const systemHealthy = systemLevel !== SystemHealthLevel.Critical && systemLevel !== SystemHealthLevel.Failed;
    const alertList = this.alerts.evaluate(resourceUsage, moduleErrors, systemHealthy);

    this.responseTimes.record({
      moduleResponseMs: this.averageResponseTime(checks),
      communicationLatencyMs: checks.find((c) => c.name === "communication-status")?.responseTimeMs ?? 0,
      storageResponseMs: checks.find((c) => c.name === "storage-status")?.responseTimeMs ?? 0,
      databaseResponseMs: 0,
      apiResponseMs: Date.now() - start,
      aiResponseMs: this.averageResponseTime(checks.filter((c) => c.name.includes("engine"))),
    });

    if (systemLevel === SystemHealthLevel.Warning) {
      const warningResult = await this.automaticActions.handleWarning(moduleScores);
      this.lastRecommendations = warningResult.recommendations;
    }

    let recoveryActivity: string[] = [];
    if (systemLevel === SystemHealthLevel.Critical || systemLevel === SystemHealthLevel.Failed) {
      const criticalResults = await this.automaticActions.handleCritical(moduleScores, this.recoveryEngine);
      recoveryActivity = criticalResults.map((r) => `${r.action}:${r.success ? "ok" : "failed"}`);

      if (criticalResults.some((r) => r.success)) {
        await this.runner!.runAll();
      }
    }

    const scanMs = Date.now() - start;
    this.scanCount += 1;
    this.totalScanMs += scanMs;

    this.history.append({
      healthId: `health-${randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      module: "system",
      healthScore: systemScore,
      level: systemLevel,
      warnings,
      errors,
      recoveryResult: recoveryActivity.length ? recoveryActivity.join("; ") : undefined,
      performanceMs: scanMs,
      recommendations: this.lastRecommendations.map((r) => r.message),
    });

    this.lastDashboard = this.dashboardBuilder.build(
      systemScore,
      systemLevel,
      moduleScores,
      resourceUsage,
      this.responseTimes.getLatest(),
      warnings,
      errors,
      recoveryActivity,
      alertList,
      this.history
    );

    this.logger.log("info", "performance", `Health scan: score ${systemScore} (${systemLevel})`, {
      scanMs,
      warnings: warnings.length,
      errors: errors.length,
    });

    return this.lastDashboard;
  }

  getDashboardData(): HealthDashboardData | null {
    return this.lastDashboard;
  }

  getMonitoredComponentCount(): number {
    return MONITORED_COMPONENTS.length;
  }

  getLastRecommendations(): HealthRecommendation[] {
    return this.lastRecommendations;
  }

  buildStatusReport(): HealthMonitorStatusReport {
    const dashboard = this.lastDashboard;
    const knownIssues: string[] = [];

    if (dashboard?.errors.length) {
      knownIssues.push(...dashboard.errors.slice(0, 5));
    }

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (dashboard && dashboard.applicationHealth === SystemHealthLevel.Critical) readinessScore -= 30;
    if (dashboard && dashboard.applicationHealth === SystemHealthLevel.Failed) readinessScore = 0;

    return {
      healthMonitorStatus: this.initialized ? "operational" : "not-initialized",
      applicationHealth: dashboard?.applicationHealth ?? SystemHealthLevel.Good,
      moduleHealth: dashboard
        ? `${dashboard.moduleHealth.filter((m) => m.available).length}/${dashboard.moduleHealth.length} modules available`
        : "not scanned",
      performance: {
        scanTimeMs: this.scanCount > 0 ? Math.round(this.totalScanMs / this.scanCount) : 0,
        totalScans: this.scanCount,
        averageScanMs: this.scanCount > 0 ? Math.round(this.totalScanMs / this.scanCount) : 0,
      },
      warnings: dashboard?.warnings ?? [],
      knownIssues,
      readinessScore: Math.max(0, Math.min(100, readinessScore)),
      timestamp: new Date().toISOString(),
    };
  }

  private averageResponseTime(checks: Array<{ responseTimeMs?: number }>): number {
    const times = checks.map((c) => c.responseTimeMs ?? 0).filter((t) => t > 0);
    if (!times.length) return 0;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }

  private createDeps() {
    return {
      getCore: () => this.core!,
      getModuleManager: () => this.moduleManager,
      getStateManager: () => this.stateManager,
      getCommunicationBus: () => this.communicationBus,
      getRecoveryEngine: () => this.recoveryEngine,
      storageRoot: this.storageRoot,
    };
  }

  private ensureReady(): void {
    if (!this.initialized || !this.core) {
      throw new HealthMonitorError("Health Monitor not initialized", "NOT_INITIALIZED");
    }
  }
}
