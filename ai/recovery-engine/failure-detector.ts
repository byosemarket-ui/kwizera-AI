import fs from "node:fs";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { AiCommunicationBus } from "../communication-bus/communication-bus.js";
import type { AiModuleManager } from "../module-manager/module-manager.js";
import type { AiStateManager } from "../state-manager/state-manager.js";
import { RecoveryEngineLogger } from "./recovery-logger.js";
import { FailureReport, FailureType, MonitoredComponent } from "./types.js";

let failureCounter = 0;

export interface FailureDetectorDeps {
  getCore: () => AiCoreManager;
  getModuleManager: () => AiModuleManager | null;
  getStateManager: () => AiStateManager | null;
  getCommunicationBus: () => AiCommunicationBus | null;
  storageRoot: string;
}

export class FailureDetector {
  private readonly detectedFailures: FailureReport[] = [];

  constructor(
    private readonly deps: FailureDetectorDeps,
    private readonly logger: RecoveryEngineLogger
  ) {}

  async scanAll(): Promise<FailureReport[]> {
    const failures: FailureReport[] = [];

    failures.push(...this.checkApplication());
    failures.push(...this.checkAiCore());
    failures.push(...this.checkModuleManager());
    failures.push(...this.checkWorkflowEngine());
    failures.push(...this.checkTaskManager());
    failures.push(...this.checkCommunicationBus());
    failures.push(...this.checkStateManager());
    failures.push(...this.checkStorage());
    failures.push(...this.checkConfiguration());
    failures.push(...this.checkUnexpectedShutdown());

    for (const failure of failures) {
      this.detectedFailures.push(failure);
      this.logger.log("warn", "failure", `Failure detected: ${failure.failureType}`, {
        failureId: failure.failureId,
        component: failure.affectedComponent,
        rootCause: failure.rootCause,
      });
    }

    return failures;
  }

  getDetectedFailures(): ReadonlyArray<FailureReport> {
    return this.detectedFailures;
  }

  private checkApplication(): FailureReport[] {
    const state = this.deps.getStateManager()?.getApplicationState();
    if (state === "recovering") {
      return [this.createReport(FailureType.Application, MonitoredComponent.Application, "Application in recovery state", "high")];
    }
    return [];
  }

  private checkAiCore(): FailureReport[] {
    const core = this.deps.getCore();
    if (!core.isStarted()) {
      return [this.createReport(FailureType.Startup, MonitoredComponent.AiCore, "AI Core not started", "critical")];
    }
    const lifecycle = core.getLifecycleState();
    if (lifecycle === "failed") {
      return [this.createReport(FailureType.Application, MonitoredComponent.AiCore, "AI Core lifecycle failed", "critical")];
    }
    return [];
  }

  private checkModuleManager(): FailureReport[] {
    const manager = this.deps.getModuleManager();
    if (!manager?.isInitialized()) {
      return [this.createReport(FailureType.Module, MonitoredComponent.ModuleManager, "Module Manager not initialized", "high")];
    }
    const report = manager.buildStatusReport();
    if (report.knownIssues.length > 0) {
      return report.knownIssues.map((issue) =>
        this.createReport(FailureType.Module, MonitoredComponent.ModuleManager, issue, "medium")
      );
    }
    return [];
  }

  private checkWorkflowEngine(): FailureReport[] {
    const engine = this.deps.getCore().workflowEngine;
    if (!engine?.isInitialized()) return [];
    const workflows = this.deps.getStateManager()?.getCurrentSnapshot().workflows ?? {};
    const failed = Object.entries(workflows).filter(([, w]) => w.state === "failed");
    return failed.map(([id]) =>
      this.createReport(FailureType.Workflow, MonitoredComponent.WorkflowEngine, `Workflow ${id} failed`, "high", { workflowId: id })
    );
  }

  private checkTaskManager(): FailureReport[] {
    const tasks = this.deps.getStateManager()?.getCurrentSnapshot().tasks ?? {};
    const failed = Object.entries(tasks).filter(([, t]) => t.state === "failed");
    return failed.map(([id]) =>
      this.createReport(FailureType.Task, MonitoredComponent.TaskManager, `Task ${id} failed`, "medium", { taskId: id })
    );
  }

  private checkCommunicationBus(): FailureReport[] {
    const bus = this.deps.getCommunicationBus();
    if (!bus?.isInitialized()) return [];
    const failures = bus.getValidationFailures();
    if (failures.length > 0) {
      return [this.createReport(FailureType.Communication, MonitoredComponent.CommunicationBus, `${failures.length} communication rejection(s)`, "low")];
    }
    return [];
  }

  private checkStateManager(): FailureReport[] {
    const state = this.deps.getStateManager();
    if (!state?.isInitialized()) {
      return [this.createReport(FailureType.Application, MonitoredComponent.StateManager, "State Manager not initialized", "high")];
    }
    const recoveryMsg = state.getLastRecoveryMessage();
    if (recoveryMsg) {
      return [this.createReport(FailureType.UnexpectedShutdown, MonitoredComponent.StateManager, recoveryMsg, "high")];
    }
    return [];
  }

  private checkStorage(): FailureReport[] {
    if (!fs.existsSync(this.deps.storageRoot)) {
      return [this.createReport(FailureType.Storage, MonitoredComponent.Storage, "Storage root missing", "critical")];
    }
    return [];
  }

  private checkConfiguration(): FailureReport[] {
    if (!this.deps.getCore().configuration.isLoaded()) {
      return [this.createReport(FailureType.Configuration, MonitoredComponent.Configuration, "Configuration not loaded", "high")];
    }
    return [];
  }

  private checkUnexpectedShutdown(): FailureReport[] {
    const snapshot = this.deps.getStateManager()?.snapshots.loadLatestSnapshot();
    if (snapshot && !snapshot.cleanShutdown) {
      return [this.createReport(FailureType.UnexpectedShutdown, MonitoredComponent.Application, "Unclean shutdown detected", "critical", { snapshotId: snapshot.snapshotId })];
    }
    return [];
  }

  private createReport(
    type: FailureType,
    component: string,
    rootCause: string,
    severity: FailureReport["severity"],
    diagnostics: Record<string, unknown> = {}
  ): FailureReport {
    return {
      failureId: `fail-${++failureCounter}-${Date.now()}`,
      failureType: type,
      affectedComponent: component,
      rootCause,
      timestamp: new Date().toISOString(),
      severity,
      diagnostics,
    };
  }
}
