import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiLifecycleState } from "../core/types.js";
import { StateAutoSave } from "./state-auto-save.js";
import { StateHistoryStore } from "./state-history-store.js";
import { StateManagerLogger } from "./state-logger.js";
import { StateRecovery } from "./state-recovery.js";
import { StateRestoration } from "./state-restoration.js";
import { StateSnapshotStore } from "./state-snapshot-store.js";
import { StateTransitionValidator } from "./state-transition-validator.js";
import {
  ApplicationState,
  ApplicationStateSnapshot,
  AutoSaveTrigger,
  EntityStateRecord,
  ProjectState,
  RestorationResult,
  SessionStateManaged,
  StateDomain,
  StateHistoryRecord,
  StateManagerError,
  StateManagerStatusReport,
  StateSnapshot,
  StateTransitionContext,
  StateTransitionResult,
  SystemState,
  TaskStateManaged,
  WorkflowStateManaged,
} from "./types.js";

let stateIdCounter = 0;

/**
 * AI State Manager — single source of truth for KWIZERA AI STUDIO application state.
 */
export class AiStateManager {
  private core: AiCoreManager | null = null;
  private storageRoot = "";
  private initialized = false;

  private readonly current: ApplicationStateSnapshot = {
    application: ApplicationState.Stopped,
    aiCore: AiLifecycleState.Stopped,
    system: SystemState.Offline,
    modules: {},
    workflows: {},
    tasks: {},
    projects: {},
    sessions: {},
  };

  readonly logger = new StateManagerLogger();
  readonly history = new StateHistoryStore();
  readonly snapshots = new StateSnapshotStore(this.logger);
  private readonly validator = new StateTransitionValidator();
  private autoSave: StateAutoSave | null = null;
  private restoration: StateRestoration | null = null;
  private recovery: StateRecovery | null = null;

  private stateUpdateCount = 0;
  private totalUpdateMs = 0;
  private lastRestoration: RestorationResult | null = null;
  private lastRecoveryMessage: string | null = null;

  initialize(core: AiCoreManager, storageRoot: string): void {
    this.core = core;
    this.storageRoot = storageRoot;
    const logDir = path.join(storageRoot, "logs");
    const stateDir = path.join(storageRoot, "state");
    this.logger.initialize(logDir);
    this.history.initialize(stateDir);
    this.snapshots.initialize(stateDir);
    this.autoSave = new StateAutoSave(this.logger, this.snapshots);
    this.restoration = new StateRestoration(this.snapshots, this.logger);
    this.recovery = new StateRecovery(this.snapshots, this.logger);
    this.initialized = true;
    this.logger.log("info", "state-change", "AI State Manager initialized", { storageRoot });
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async restoreOnStartup(): Promise<RestorationResult | null> {
    this.ensureReady();
    const snapshot = this.restoration!.findRestorableSnapshot();
    if (!snapshot) {
      this.setApplicationState(ApplicationState.Starting, { systemAction: "cold-start" });
      this.createSnapshot("application-start");
      return null;
    }

    if (this.recovery!.wasUncleanShutdown(snapshot)) {
      const recoveryResult = this.recovery!.recoverFromUnexpectedShutdown(snapshot, this.current);
      this.lastRecoveryMessage = recoveryResult.message;
      this.recordHistory("application", snapshot.state.application, ApplicationState.Recovering, "unexpected-shutdown-recovery", {
        systemAction: "recovery",
        recoveryInformation: recoveryResult.message,
      });
      this.current.system = SystemState.Operational;
      this.createSnapshot("recovery-complete");
      return {
        restored: true,
        snapshotId: snapshot.snapshotId,
        restoredWorkflows: recoveryResult.unfinishedWorkflows.length,
        restoredTasks: recoveryResult.unfinishedTasks.length,
        restoredProjects: Object.keys(snapshot.state.projects).length,
        restoredSessions: Object.keys(snapshot.state.sessions).length,
        message: recoveryResult.message,
      };
    }

    const result = this.restoration!.restore(snapshot, this.current);
    this.lastRestoration = result;
    this.createSnapshot("application-start");
    return result;
  }

  getCurrentSnapshot(): ApplicationStateSnapshot {
    return structuredClone(this.current);
  }

  setApplicationState(state: ApplicationState, context?: StateTransitionContext): StateTransitionResult {
    return this.transition("application", this.current.application, state, (next) => {
      if (!this.validator.validateApplication(this.current.application, next)) {
        return false;
      }
      this.current.application = next;
      return true;
    }, context);
  }

  syncAiCoreState(aiCoreState: AiLifecycleState, context?: StateTransitionContext): StateTransitionResult {
    const mapped = this.validator.mapAiCoreToApplication(aiCoreState);
    this.current.aiCore = aiCoreState;
    if (this.current.application !== mapped) {
      return this.setApplicationState(mapped, {
        ...context,
        systemAction: "ai-core-sync",
      });
    }
    return { accepted: true, previousState: this.current.application, currentState: mapped, message: "AI Core synced" };
  }

  setSystemState(state: SystemState, context?: StateTransitionContext): StateTransitionResult {
    return this.transition("system", this.current.system, state, (next) => {
      this.current.system = next;
      return true;
    }, context);
  }

  reportModuleState(moduleId: string, state: string, context?: StateTransitionContext): StateTransitionResult {
    const previous = this.current.modules[moduleId]?.state ?? "unknown";
    const result = this.transition("module", previous, state, () => {
      this.current.modules[moduleId] = {
        id: moduleId,
        state,
        updatedAt: new Date().toISOString(),
      };
      return true;
    }, context, moduleId);
    if (result.accepted) {
      this.createSnapshot("module-state-change");
    }
    return result;
  }

  updateWorkflowState(
    workflowId: string,
    state: WorkflowStateManaged,
    context?: StateTransitionContext
  ): StateTransitionResult {
    const previous = (this.current.workflows[workflowId]?.state ?? WorkflowStateManaged.Created) as WorkflowStateManaged;
    const result = this.transition("workflow", previous, state, (next) => {
      if (!this.validator.validateWorkflow(previous, next)) return false;
      this.current.workflows[workflowId] = {
        id: workflowId,
        state: next,
        updatedAt: new Date().toISOString(),
        metadata: context?.recoveryInformation ? { recovery: context.recoveryInformation } : undefined,
      };
      return true;
    }, context, workflowId);
    if (result.accepted) {
      this.createSnapshot("workflow-change");
      this.autoSave!.trigger("workflow-execution", this.current);
    }
    return result;
  }

  updateTaskState(taskId: string, state: TaskStateManaged, context?: StateTransitionContext): StateTransitionResult {
    const previous = (this.current.tasks[taskId]?.state ?? TaskStateManaged.Queued) as TaskStateManaged;
    const result = this.transition("task", previous, state, (next) => {
      if (!this.validator.validateTask(previous, next)) return false;
      this.current.tasks[taskId] = {
        id: taskId,
        state: next,
        updatedAt: new Date().toISOString(),
        metadata: context?.metadata,
      };
      return true;
    }, context, taskId);
    if (result.accepted) {
      this.createSnapshot("task-change");
    }
    return result;
  }

  updateProjectState(projectId: string, state: ProjectState, context?: StateTransitionContext): StateTransitionResult {
    const previous = (this.current.projects[projectId]?.state ?? ProjectState.New) as ProjectState;
    const result = this.transition("project", previous, state, (next) => {
      if (!this.validator.validateProject(previous, next)) return false;
      this.current.projects[projectId] = {
        id: projectId,
        state: next,
        updatedAt: new Date().toISOString(),
      };
      return true;
    }, context, projectId);
    if (result.accepted) {
      this.createSnapshot("project-change");
      if (state === ProjectState.Modified || state === ProjectState.Saving) {
        this.autoSave!.trigger("project-editing", this.current);
      }
    }
    return result;
  }

  updateSessionState(
    sessionId: string,
    state: SessionStateManaged,
    context?: StateTransitionContext
  ): StateTransitionResult {
    const previous = (this.current.sessions[sessionId]?.state ?? SessionStateManaged.Created) as SessionStateManaged;
    const result = this.transition("session", previous, state, (next) => {
      if (!this.validator.validateSession(previous, next)) return false;
      this.current.sessions[sessionId] = {
        id: sessionId,
        state: next,
        updatedAt: new Date().toISOString(),
      };
      return true;
    }, context, sessionId);
    if (result.accepted) {
      this.createSnapshot("session-change");
    }
    return result;
  }

  triggerAutoSave(trigger: AutoSaveTrigger): void {
    this.ensureReady();
    if (!this.autoSave!.supports(trigger)) {
      throw new StateManagerError(`Unsupported auto-save trigger: ${trigger}`, "INVALID_TRIGGER");
    }
    this.autoSave!.trigger(trigger, this.current);
  }

  createSnapshot(reason: string, cleanShutdown = false): StateSnapshot {
    this.ensureReady();
    const snapshot: StateSnapshot = {
      snapshotId: `snap-${randomUUID().slice(0, 8)}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      reason,
      cleanShutdown,
      state: structuredClone(this.current),
    };
    this.snapshots.saveSnapshot(snapshot);
    return snapshot;
  }

  saveShutdownSnapshot(reason = "application-shutdown"): StateSnapshot {
    this.setApplicationState(ApplicationState.Stopping, { systemAction: reason });
    const snapshot = this.createSnapshot(reason, true);
    this.setApplicationState(ApplicationState.Stopped, { systemAction: reason });
    return snapshot;
  }

  getWorkflowState(workflowId: string): EntityStateRecord | undefined {
    return this.current.workflows[workflowId];
  }

  getTaskState(taskId: string): EntityStateRecord | undefined {
    return this.current.tasks[taskId];
  }

  getProjectState(projectId: string): EntityStateRecord | undefined {
    return this.current.projects[projectId];
  }

  getSessionState(sessionId: string): EntityStateRecord | undefined {
    return this.current.sessions[sessionId];
  }

  getApplicationState(): ApplicationState {
    return this.current.application;
  }

  getLastRestoration(): RestorationResult | null {
    return this.lastRestoration;
  }

  getLastRecoveryMessage(): string | null {
    return this.lastRecoveryMessage;
  }

  buildStatusReport(): StateManagerStatusReport {
    const mem = process.memoryUsage();
    const avgUpdate =
      this.stateUpdateCount > 0 ? Math.round(this.totalUpdateMs / this.stateUpdateCount) : 0;
    const knownIssues: string[] = [];

    if (this.lastRecoveryMessage) {
      knownIssues.push(this.lastRecoveryMessage);
    }

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;

    return {
      stateManagerStatus: this.initialized ? "operational" : "not-initialized",
      snapshotStatus: `${this.snapshots.getSnapshotCount()} snapshot(s) on record`,
      recoveryStatus: this.lastRecoveryMessage ?? "no recovery required",
      autoSaveStatus: `${this.autoSave?.getTriggeredCount() ?? 0} auto-save(s)`,
      performance: {
        stateUpdates: this.stateUpdateCount,
        snapshotsCreated: this.snapshots.getSnapshotCount(),
        averageUpdateMs: avgUpdate,
        diskWrites: this.snapshots.getDiskWrites(),
        memoryUsageMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      },
      knownIssues,
      readinessScore,
      timestamp: new Date().toISOString(),
    };
  }

  private transition<T extends string>(
    domain: StateDomain,
    previous: T,
    next: T,
    apply: (next: T) => boolean,
    context?: StateTransitionContext,
    entityId?: string
  ): StateTransitionResult {
    this.ensureReady();
    const start = Date.now();

    if (previous === next) {
      return { accepted: true, previousState: previous, currentState: next, message: "No change" };
    }

    const accepted = apply(next);
    if (!accepted) {
      this.logger.log("warn", "failure", `Rejected state transition: ${domain} ${previous} → ${next}`, {
        domain,
        entityId,
      });
      return {
        accepted: false,
        previousState: previous,
        currentState: previous,
        message: `Invalid transition: ${previous} → ${next}`,
      };
    }

    this.recordHistory(domain, previous, next, context?.reason ?? "state-update", context, entityId);
    this.stateUpdateCount += 1;
    this.totalUpdateMs += Date.now() - start;

    return {
      accepted: true,
      previousState: previous,
      currentState: next,
      message: `${domain} state updated`,
    };
  }

  private recordHistory(
    module: string,
    previousState: string,
    currentState: string,
    reason: string,
    context?: StateTransitionContext,
    entityId?: string
  ): void {
    const record: StateHistoryRecord = {
      stateId: `state-${++stateIdCounter}-${Date.now()}`,
      time: new Date().toISOString(),
      module: entityId ? `${module}:${entityId}` : module,
      previousState,
      currentState,
      reason,
      userAction: context?.userAction,
      systemAction: context?.systemAction,
      recoveryInformation: context?.recoveryInformation,
    };
    this.history.append(record);
    this.logger.log("info", "state-change", `${record.module}: ${previousState} → ${currentState}`, {
      reason,
    });
  }

  private ensureReady(): void {
    if (!this.initialized) {
      throw new StateManagerError("State Manager not initialized", "NOT_INITIALIZED");
    }
  }
}
