import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { BackupValidator } from "./backup-validator.js";
import { DiagnosticsGenerator } from "./diagnostics-generator.js";
import { FailureDetector } from "./failure-detector.js";
import { MemoryProtection } from "./memory-protection.js";
import { ProjectRecovery } from "./project-recovery.js";
import { RecoveryEngineLogger } from "./recovery-logger.js";
import { RecoveryExecutor } from "./recovery-executor.js";
import { RecoveryHistoryStore } from "./recovery-history-store.js";
import { SelfHealing } from "./self-healing.js";
import { VideoRecovery } from "./video-recovery.js";
import {
  FailureReport,
  RecoveryEngineError,
  RecoveryEngineStatusReport,
  RecoveryExecutionResult,
  RecoveryResultStatus,
} from "./types.js";

/**
 * AI Recovery Engine — detects failures and restores KWIZERA AI STUDIO to last stable state.
 */
export class AiRecoveryEngine {
  private core: AiCoreManager | null = null;
  private moduleManager: AiModuleManager | null = null;
  private stateManager: AiStateManager | null = null;
  private communicationBus: AiCommunicationBus | null = null;
  private storageRoot = "";
  private initialized = false;

  readonly logger = new RecoveryEngineLogger();
  readonly history = new RecoveryHistoryStore();
  private readonly diagnostics = new DiagnosticsGenerator(this.logger);
  private readonly backupValidator = new BackupValidator(this.logger);
  private readonly memoryProtection = new MemoryProtection(this.logger);
  private readonly projectRecovery = new ProjectRecovery(this.logger);
  private readonly videoRecovery = new VideoRecovery(this.logger);
  private readonly selfHealing = new SelfHealing(this.logger);

  private detector: FailureDetector | null = null;
  private executor: RecoveryExecutor | null = null;
  private lastScanFailures: FailureReport[] = [];
  private startupRecoveryComplete = false;

  initialize(
    core: AiCoreManager,
    storageRoot: string,
    moduleManager?: AiModuleManager,
    stateManager?: AiStateManager,
    communicationBus?: AiCommunicationBus
  ): void {
    this.core = core;
    this.storageRoot = storageRoot;
    this.moduleManager = moduleManager ?? null;
    this.stateManager = stateManager ?? null;
    this.communicationBus = communicationBus ?? null;

    const logDir = path.join(storageRoot, "logs");
    const recoveryDir = path.join(storageRoot, "recovery");
    this.logger.initialize(logDir);
    this.history.initialize(recoveryDir);
    this.diagnostics.initialize(recoveryDir);

    const deps = this.createDeps();
    this.detector = new FailureDetector(deps, this.logger);
    this.executor = new RecoveryExecutor(
      deps,
      this.logger,
      this.history,
      this.diagnostics,
      this.backupValidator,
      this.memoryProtection,
      this.projectRecovery,
      this.videoRecovery,
      this.selfHealing
    );

    this.initialized = true;
    this.logger.log("info", "recovery-success", "AI Recovery Engine initialized", { storageRoot });
  }

  setModuleManager(manager: AiModuleManager): void {
    this.moduleManager = manager;
    this.refreshDeps();
  }

  setStateManager(manager: AiStateManager): void {
    this.stateManager = manager;
    this.refreshDeps();
  }

  setCommunicationBus(bus: AiCommunicationBus): void {
    this.communicationBus = bus;
    this.refreshDeps();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async runStartupRecovery(): Promise<RecoveryExecutionResult[]> {
    this.ensureReady();
    const results: RecoveryExecutionResult[] = [];

    this.memoryProtection.verify(this.storageRoot);

    const failures = await this.detector!.scanAll();
    this.lastScanFailures = failures;

    const critical = failures.filter((f) => f.severity === "critical" || f.severity === "high");
    const toRecover = critical.length > 0 ? critical : failures.slice(0, 1);

    for (const failure of toRecover) {
      const result = await this.executor!.execute(failure);
      results.push(result);
    }

    this.startupRecoveryComplete = true;
    return results;
  }

  async scanForFailures(): Promise<FailureReport[]> {
    this.ensureReady();
    this.lastScanFailures = await this.detector!.scanAll();
    return this.lastScanFailures;
  }

  async recoverFromFailure(failure: FailureReport): Promise<RecoveryExecutionResult> {
    this.ensureReady();
    return this.executor!.execute(failure);
  }

  async recoverModule(moduleId: string): Promise<RecoveryExecutionResult> {
    const failure: FailureReport = {
      failureId: `manual-${Date.now()}`,
      failureType: "module" as never,
      affectedComponent: moduleId,
      rootCause: `Manual module recovery requested for ${moduleId}`,
      timestamp: new Date().toISOString(),
      severity: "medium",
      diagnostics: { moduleId },
    };
    return this.recoverFromFailure(failure);
  }

  getLastScanFailures(): FailureReport[] {
    return this.lastScanFailures;
  }

  isStartupRecoveryComplete(): boolean {
    return this.startupRecoveryComplete;
  }

  buildStatusReport(): RecoveryEngineStatusReport {
    const successRate = this.history.getSuccessRate();
    const knownIssues: string[] = [];

    if (this.lastScanFailures.length > 0) {
      knownIssues.push(`${this.lastScanFailures.length} failure(s) detected in last scan`);
    }

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (successRate < 80 && this.history.getCount() > 0) readinessScore -= 20;

    const mem = process.memoryUsage();

    return {
      recoveryEngineStatus: this.initialized ? "operational" : "not-initialized",
      failureDetectionStatus: `${this.lastScanFailures.length} failure(s) in last scan`,
      recoverySuccessRate: successRate,
      dataProtectionStatus: this.memoryProtection.verify(this.storageRoot).verified
        ? "memory categories protected"
        : "protection unverified",
      stateRestorationStatus: this.startupRecoveryComplete
        ? "startup recovery complete"
        : "pending startup recovery",
      performance: {
        averageRecoveryMs: this.executor?.getAverageRecoveryMs() ?? 0,
        totalRecoveries: this.history.getCount(),
        failuresDetected: this.lastScanFailures.length,
        selfHealingActions: this.selfHealing.getActionCount(),
      },
      knownIssues,
      readinessScore: Math.max(0, Math.min(100, readinessScore)),
      timestamp: new Date().toISOString(),
    };
  }

  private createDeps() {
    return {
      getCore: () => this.core!,
      getModuleManager: () => this.moduleManager,
      getStateManager: () => this.stateManager,
      getCommunicationBus: () => this.communicationBus,
      storageRoot: this.storageRoot,
    };
  }

  private refreshDeps(): void {
    if (!this.initialized) return;
    const deps = this.createDeps();
    this.detector = new FailureDetector(deps, this.logger);
    this.executor = new RecoveryExecutor(
      deps,
      this.logger,
      this.history,
      this.diagnostics,
      this.backupValidator,
      this.memoryProtection,
      this.projectRecovery,
      this.videoRecovery,
      this.selfHealing
    );
  }

  private ensureReady(): void {
    if (!this.initialized || !this.core) {
      throw new RecoveryEngineError("Recovery Engine not initialized", "NOT_INITIALIZED");
    }
  }
}
