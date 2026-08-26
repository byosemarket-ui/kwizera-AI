import { loadStep2PipelineHandoff } from "../production-queue/queue-engine";
import type { ProductionExecutionPackage } from "../production-queue/types";
import {
  assemblePipelineState,
  buildAiMePipelineExplanation,
  classifyPipelineError,
  computeWeightedProgress,
  maybeCheckpoint,
  step2Complete,
  unlockDependencies,
} from "./assemble";
import { executeTask, pickReadyTasks, workerIdFor } from "./executor";
import type {
  PipelineState,
  PipelineUiSnapshot,
  Step3CommandCenterHandoffPayload,
  TaskAttempt,
  PipelineError,
} from "./types";
import {
  PIPELINE_ARTIFACT_KEY,
  PIPELINE_HANDOFF_KEY,
  PIPELINE_MEMORY_KEY,
  PIPELINE_STORE_KEY,
  STAGE_LABELS,
} from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;
type Listener = (snap: PipelineUiSnapshot) => void;

interface StoreEntry {
  state: PipelineState;
}

function loadStore(): Record<string, StoreEntry> {
  try {
    return JSON.parse(localStorage.getItem(PIPELINE_STORE_KEY) ?? "{}") as Record<string, StoreEntry>;
  } catch {
    return {};
  }
}

function saveEntry(entry: StoreEntry): void {
  const map = loadStore();
  map[entry.state.run.projectId] = entry;
  localStorage.setItem(PIPELINE_STORE_KEY, JSON.stringify(map));
  localStorage.setItem(PIPELINE_ARTIFACT_KEY, JSON.stringify({
    productionId: entry.state.run.productionId,
    artifacts: entry.state.artifacts,
    updatedAt: new Date().toISOString(),
  }));
}

function saveMemory(projectId: string, payload: Record<string, unknown>): void {
  try {
    const mem = JSON.parse(localStorage.getItem(PIPELINE_MEMORY_KEY) ?? "{}") as Record<string, unknown>;
    mem[projectId] = { ...payload, updatedAt: new Date().toISOString() };
    localStorage.setItem(PIPELINE_MEMORY_KEY, JSON.stringify(mem));
  } catch { /* ignore */ }
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export class ProductionPipelineEngine {
  private state: PipelineState | null = null;
  private pkg: ProductionExecutionPackage | null = null;
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private recommendation = "Acknowledge READY TO EXECUTE on Production Queue (Phase 5 Step 1), then start production.";
  private handoffReady = false;
  private ticking = false;
  private loopPromise: Promise<void> | null = null;
  private allowHttp = true;

  setNotify(fn: NotifyFn | null): void { this.notify = fn; }
  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void { this.emitEvents = fn; }
  setAllowHttp(allow: boolean): void { this.allowHttp = allow; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): PipelineUiSnapshot {
    return {
      version: 1,
      state: this.state,
      recommendation: this.recommendation,
      handoffReady: this.handoffReady,
      ticking: this.ticking,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    if (!this.state) {
      return { running: false, explanation: "No active Production Run. Start from a READY Production Execution Package.", recommendation: this.recommendation };
    }
    return {
      projectId: this.state.run.projectId,
      productionId: this.state.run.productionId,
      runId: this.state.run.runId,
      status: this.state.run.status,
      progress: this.state.run.progress,
      readyForStep3: this.state.readyForStep3,
      running: this.ticking || this.state.run.status === "RUNNING",
      recommendation: this.recommendation,
      explanation: buildAiMePipelineExplanation(this.state),
    };
  }

  hydrate(): boolean {
    const handoff = loadStep2PipelineHandoff();
    this.pkg = handoff;
    if (!handoff || handoff.step !== "phase-5-step-2-pipeline-engine") {
      this.recommendation = "No Production Execution Package found. Complete Phase 5 Step 1 first.";
      this.emit();
      return false;
    }
    const stored = loadStore()[handoff.projectId];
    if (stored?.state) {
      this.state = stored.state;
      // Recovery: interrupted running tasks → READY/RETRYING
      this.state.tasks = this.state.tasks.map((t) => {
        if (t.status === "RUNNING" || t.status === "STARTING" || t.status === "VALIDATING") {
          return { ...t, status: "READY" as const, progress: 0, error: null };
        }
        return t;
      });
      this.state.tasks = unlockDependencies(this.state.tasks);
      if (this.state.run.status === "RUNNING") {
        this.state.run.status = "PAUSED";
        this.state.run.pauseRequested = true;
      }
      this.state.run.activeWorkerIds = [];
      this.state.run.warnings = [...new Set([...this.state.run.warnings, "Recovered from prior session — incomplete tasks re-queued."])];
      this.handoffReady = this.state.readyForStep3;
      this.recommendation = this.state.readyForStep3
        ? `Restored run ${this.state.run.runId} — READY FOR STEP 3. Step 3 is not started.`
        : `Restored Production Run ${this.state.run.runId} (${this.state.run.status}). Resume when ready.`;
      this.emitAction("ProductionRecovered", { runId: this.state.run.runId, productionId: this.state.run.productionId });
      this.persist();
      this.emit();
      return true;
    }
    this.state = assemblePipelineState(handoff);
    this.recommendation = `Execution package loaded for ${handoff.productionId}. Click START PRODUCTION to begin. Final render remains Step 4.`;
    this.persist();
    this.emit();
    return true;
  }

  async start(): Promise<PipelineState> {
    if (!this.pkg && !this.hydrate()) throw new Error("Production Execution Package required");
    if (!this.state) this.state = assemblePipelineState(this.pkg!);
    if (this.state.run.status === "READY_FOR_STEP3" || this.state.readyForStep3) {
      this.recommendation = "Step 2 already complete for this run.";
      this.emit();
      return this.state;
    }
    if (this.ticking) return this.state;

    this.state.run.status = "RUNNING";
    this.state.run.pauseRequested = false;
    this.state.run.cancelRequested = false;
    this.state.run.startedAt = this.state.run.startedAt || new Date().toISOString();
    this.state.run.updatedAt = new Date().toISOString();
    this.state.job = { ...this.state.job, status: "RUNNING" };
    this.recommendation = `Production started — run ${this.state.run.runId}.`;
    this.emitAction("ProductionStarted", { runId: this.state.run.runId, productionId: this.state.run.productionId });
    this.emitBus("product-analysis.started", { phase: "production-pipeline", runId: this.state.run.runId });
    this.persist();
    this.emit();
    this.loopPromise = this.runLoop();
    return this.state;
  }

  pause(): void {
    if (!this.state) return;
    this.state.run.pauseRequested = true;
    this.state.run.status = "PAUSED";
    this.state.job = { ...this.state.job, status: "PAUSED" };
    this.recommendation = "Production paused. Completed outputs preserved.";
    this.emitAction("ProductionPaused", { runId: this.state.run.runId });
    this.persist();
    this.emit();
  }

  async resume(): Promise<void> {
    if (!this.state) return;
    this.state.run.pauseRequested = false;
    this.state.run.status = "RUNNING";
    this.state.job = { ...this.state.job, status: "RUNNING" };
    this.recommendation = "Production resumed.";
    this.emitAction("ProductionResumed", { runId: this.state.run.runId });
    this.persist();
    this.emit();
    if (!this.ticking) this.loopPromise = this.runLoop();
  }

  cancel(): void {
    if (!this.state) return;
    this.state.run.cancelRequested = true;
    this.state.run.pauseRequested = false;
    this.state.run.status = "CANCELLED";
    this.state.run.endedAt = new Date().toISOString();
    this.state.job = { ...this.state.job, status: "CANCELLED" };
    this.state.tasks = this.state.tasks.map((t) => (
      t.status === "READY" || t.status === "WAITING" || t.status === "PENDING" || t.status === "STARTING" || t.status === "RUNNING"
        ? { ...t, status: "CANCELLED" as const }
        : t
    ));
    this.recommendation = "Production cancelled. Completed outputs and logs preserved.";
    this.emitAction("ProductionCancelled", { runId: this.state.run.runId });
    this.persist();
    this.emit();
  }

  async retryTask(taskId: string): Promise<void> {
    if (!this.state) return;
    const task = this.state.tasks.find((t) => t.taskId === taskId);
    if (!task || task.deferredToStep4) return;
    if (task.retryCount >= task.maxRetries) {
      this.notify?.("warning", "Max retries", `${task.taskName} reached ${task.maxRetries} retries.`, "warnings");
      return;
    }
    if (task.failureClass === "CONFIGURATION" || task.failureClass === "INPUT") {
      this.notify?.("warning", "Not auto-retried", `${task.failureClass} errors require a fix first.`, "warnings");
      return;
    }
    this.state.tasks = this.state.tasks.map((t) => (
      t.taskId === taskId
        ? { ...t, status: "READY" as const, error: null, failureClass: null, progress: 0 }
        : t
    ));
    this.state.tasks = unlockDependencies(this.state.tasks);
    this.emitAction("TaskRetryStarted", { taskId, attempt: task.retryCount + 1 });
    this.persist();
    this.emit();
    if (this.state.run.status === "PAUSED" || this.state.run.status === "FAILED" || this.state.run.status === "IDLE") {
      await this.resume();
    } else if (!this.ticking && this.state.run.status === "RUNNING") {
      this.loopPromise = this.runLoop();
    }
  }

  private async runLoop(): Promise<void> {
    if (this.ticking || !this.state) return;
    this.ticking = true;
    this.emit();
    try {
      while (this.state && this.state.run.status === "RUNNING" && !this.state.run.cancelRequested) {
        if (this.state.run.pauseRequested) {
          this.state.run.status = "PAUSED";
          break;
        }
        this.state.tasks = unlockDependencies(this.state.tasks);
        const batch = pickReadyTasks(this.state, Math.max(1, this.state.run.cpuWorkers));
        if (!batch.length) {
          if (step2Complete(this.state.tasks)) {
            await this.finishStep2();
            break;
          }
          const hasActive = this.state.tasks.some((t) =>
            t.status === "RUNNING" || t.status === "STARTING" || t.status === "VALIDATING" || t.status === "RETRYING",
          );
          if (hasActive) {
            await delay(20);
            continue;
          }
          const blocked = this.state.tasks.some((t) => t.status === "BLOCKED" || t.status === "FAILED");
          const actionableLeft = this.state.tasks.some((t) =>
            !t.deferredToStep4 && t.status !== "DEFERRED_STEP4" && t.status !== "COMPLETED" && t.status !== "SKIPPED" && t.status !== "CANCELLED",
          );
          if (blocked && !this.state.tasks.some((t) => t.status === "READY")) {
            this.state.run.status = "BLOCKED";
            this.recommendation = "Production blocked — resolve failed/blocked tasks or retry.";
            this.emitAction("TaskBlocked", { productionId: this.state.run.productionId });
            break;
          }
          if (!actionableLeft) {
            await this.finishStep2();
            break;
          }
          await delay(20);
          continue;
        }

        await Promise.all(batch.map((task, idx) => this.runOne(task.taskId, idx)));
        this.refreshProgress();
        this.persist();
        this.emit();
        await delay(8);
      }
    } finally {
      this.ticking = false;
      this.persist();
      this.emit();
    }
  }

  private async runOne(taskId: string, workerIndex: number): Promise<void> {
    if (!this.state || this.state.run.pauseRequested || this.state.run.cancelRequested) return;
    const task = this.state.tasks.find((t) => t.taskId === taskId);
    if (!task || task.status !== "READY") return;

    const wid = workerIdFor(task, workerIndex);
    this.state.run.activeWorkerIds = [...this.state.run.activeWorkerIds, wid];
    this.state.run.currentTaskId = taskId;
    this.state.run.currentStage = task.stage;

    const attempt: TaskAttempt = {
      attemptId: uid("atm"),
      taskId,
      attemptNumber: task.retryCount + 1,
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: "STARTING",
      errorId: null,
      workerId: wid,
    };
    this.state.attempts = [...this.state.attempts, attempt];
    this.patchTask(taskId, { status: "STARTING", progress: 5, startedAt: attempt.startedAt, attempt: attempt.attemptNumber, lastAttemptId: attempt.attemptId });
    this.emitAction("TaskStarted", { taskId, workerId: wid, stage: task.stage });
    this.emit();

    this.patchTask(taskId, { status: "RUNNING", progress: 35 });
    this.emitAction("TaskProgressUpdated", { taskId, progress: 35 });
    this.emitBus("production.progress", { percent: this.state.run.progress, label: task.taskName });

    const result = await executeTask(this.state, { ...task, status: "RUNNING" }, { allowHttp: this.allowHttp, tickMs: 12 });

    this.patchTask(taskId, { status: "VALIDATING", progress: 85 });
    this.emitAction("TaskValidationStarted", { taskId });

    if (!result.ok || !result.artifact || result.artifact.validationState === "INVALID") {
      const msg = result.errorMessage || "Task failed validation";
      const errType = result.errorType || classifyPipelineError(msg);
      const error: PipelineError = {
        errorId: uid("err"),
        taskId,
        errorType: errType,
        message: msg,
        detail: result.notes.join("; "),
        timestamp: new Date().toISOString(),
        retryCount: task.retryCount + 1,
        recoveryRecommendation: errType === "TRANSIENT" ? "Retry when safe." : errType === "CONFIGURATION" ? "Fix configuration before retry." : "Inspect inputs and retry if appropriate.",
      };
      this.state.run.errors = [...this.state.run.errors, error];
      const nextRetry = task.retryCount + 1;
      const canAuto = errType === "TRANSIENT" && nextRetry < task.maxRetries;
      this.patchTask(taskId, {
        status: canAuto ? "RETRYING" : "FAILED",
        progress: 0,
        error: msg,
        failureClass: errType,
        retryCount: nextRetry,
        completedAt: new Date().toISOString(),
      });
      attempt.endedAt = new Date().toISOString();
      attempt.status = canAuto ? "RETRYING" : "FAILED";
      attempt.errorId = error.errorId;
      this.emitAction("TaskFailed", { taskId, error: msg, errorType: errType });
      if (canAuto) {
        this.emitAction("TaskRetryStarted", { taskId, attempt: nextRetry });
        this.patchTask(taskId, { status: "READY", error: null });
      }
    } else {
      const art = result.artifact;
      if (!result.cacheHit) {
        this.state.artifacts = [...this.state.artifacts, art];
        this.state.cacheIndex = { ...this.state.cacheIndex, [art.cacheKey]: art.artifactId };
      }
      this.patchTask(taskId, {
        status: "COMPLETED",
        progress: 100,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(attempt.startedAt).getTime(),
        artifactIds: [...task.artifactIds, art.artifactId],
        cacheHit: result.cacheHit,
        error: null,
        failureClass: null,
      });
      attempt.endedAt = new Date().toISOString();
      attempt.status = "COMPLETED";
      this.emitAction("TaskCompleted", { taskId, artifactId: art.artifactId, cacheHit: result.cacheHit });
      this.emitArtifactEvents(task.taskType, art.artifactId);
      this.emitAction("DependencyUnlocked", { taskId });
      this.maybeEmitCheckpoint(task.stage);
    }

    this.state.run.activeWorkerIds = this.state.run.activeWorkerIds.filter((id) => id !== wid);
    this.state.tasks = unlockDependencies(this.state.tasks);
    this.refreshProgress();
  }

  private async finishStep2(): Promise<void> {
    if (!this.state) return;
    const cp = maybeCheckpoint("Step 2 Pipeline Complete", this.state);
    if (cp) {
      this.state.checkpoints = [...this.state.checkpoints, cp];
      this.emitAction("CheckpointCreated", { label: cp.label, checkpointId: cp.checkpointId });
    }
    this.state.step2Complete = true;
    this.state.readyForStep3 = true;
    this.state.run.status = "READY_FOR_STEP3";
    this.state.run.endedAt = new Date().toISOString();
    this.state.job = { ...this.state.job, status: "COMPLETED", progress: this.state.run.progress };
    this.refreshProgress();

    const handoff = this.buildStep3Handoff();
    localStorage.setItem(PIPELINE_HANDOFF_KEY, JSON.stringify(handoff));
    this.handoffReady = true;
    this.recommendation = "Step 2 complete — READY FOR LIVE COMMAND CENTER / NEXT PIPELINE STAGE. Step 3 is not started. Final render remains Step 4.";
    this.emitAction("ProductionStageCompleted", { stage: "STEP2", runId: this.state.run.runId });
    this.emitBus("product-analysis.completed", { phase: "production-pipeline", runId: this.state.run.runId });
    this.persist();
    this.notify?.("success", "Pipeline Step 2 complete", "Intermediate artifacts ready. Step 3 not started.", "production-complete");
  }

  private buildStep3Handoff(): Step3CommandCenterHandoffPayload {
    const s = this.state!;
    const completed = s.tasks.filter((t) => t.status === "COMPLETED").map((t) => t.taskId);
    const remaining = s.tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "SKIPPED" && t.status !== "CANCELLED").map((t) => t.taskId);
    const next = s.tasks.filter((t) => t.status === "DEFERRED_STEP4" || t.deferredToStep4).map((t) => t.taskName);
    return {
      version: 1,
      step: "phase-5-step-3-live-command-center",
      productionId: s.run.productionId,
      runId: s.run.runId,
      projectId: s.run.projectId,
      projectName: s.job.projectName,
      pipelineState: s,
      completedTaskIds: completed,
      remainingTaskIds: remaining,
      intermediateOutputs: s.artifacts,
      sceneOutputs: s.artifacts.filter((a) => a.kind === "Scene"),
      audioOutputs: s.artifacts.filter((a) => a.kind === "Audio"),
      visualOutputs: s.artifacts.filter((a) => a.kind === "Image"),
      timelineInputs: s.artifacts.filter((a) => a.kind === "Timeline"),
      errors: s.run.errors,
      warnings: s.run.warnings,
      checkpoints: s.checkpoints,
      resourceSummary: `GPU workers ${s.run.gpuWorkers} · CPU workers ${s.run.cpuWorkers} · machine ${s.run.machineId}`,
      currentStage: s.run.currentStage,
      nextTasks: next,
      status: "READY FOR LIVE COMMAND CENTER / NEXT PIPELINE STAGE",
      preparedAt: new Date().toISOString(),
      note: "Step 3 provides live command center. Final VIDEO_RENDER / export remain Step 4. Step 3 is not auto-started.",
    };
  }

  private patchTask(taskId: string, patch: Partial<PipelineState["tasks"][number]>): void {
    if (!this.state) return;
    this.state.tasks = this.state.tasks.map((t) => (t.taskId === taskId ? { ...t, ...patch } : t));
    this.state.updatedAt = new Date().toISOString();
    this.state.run.updatedAt = this.state.updatedAt;
  }

  private refreshProgress(): void {
    if (!this.state) return;
    const { overall, stageProgress } = computeWeightedProgress(this.state.tasks);
    this.state.run.progress = overall;
    this.state.run.stageProgress = stageProgress;
    this.state.job = {
      ...this.state.job,
      progress: overall,
      completedTasks: this.state.tasks.filter((t) => t.status === "COMPLETED").length,
      failedTasks: this.state.tasks.filter((t) => t.status === "FAILED").length,
      pendingTasks: this.state.tasks.filter((t) => t.status === "READY" || t.status === "WAITING" || t.status === "PENDING").length,
      blockedTasks: this.state.tasks.filter((t) => t.status === "BLOCKED").length,
      readyTasks: this.state.tasks.filter((t) => t.status === "READY").length,
      waitingTasks: this.state.tasks.filter((t) => t.status === "WAITING").length,
    };
  }

  private maybeEmitCheckpoint(stage: PipelineState["tasks"][number]["stage"]): void {
    if (!this.state) return;
    const stageTasks = this.state.tasks.filter((t) => t.stage === stage && !t.deferredToStep4);
    if (!stageTasks.length) return;
    if (!stageTasks.every((t) => t.status === "COMPLETED" || t.status === "SKIPPED")) return;
    const label = `Assets/Stage: ${STAGE_LABELS[stage]}`;
    const cp = maybeCheckpoint(label, this.state);
    if (!cp) return;
    if (this.state.checkpoints.some((c) => c.label === label)) return;
    this.state.checkpoints = [...this.state.checkpoints, cp];
    this.emitAction("CheckpointCreated", { label, checkpointId: cp.checkpointId });
    this.emitAction("ProductionStageCompleted", { stage });
  }

  private emitArtifactEvents(taskType: string, artifactId: string): void {
    if (/VOICE/i.test(taskType)) this.emitAction("VoiceGenerated", { artifactId });
    else if (/AUDIO|MUSIC|SFX/i.test(taskType)) this.emitAction("AudioProcessed", { artifactId });
    else if (/SCENE/i.test(taskType)) this.emitAction("SceneGenerated", { artifactId });
    else this.emitAction("AssetGenerated", { artifactId, taskType });
  }

  private persist(): void {
    if (!this.state) return;
    saveEntry({ state: this.state });
    saveMemory(this.state.run.projectId, {
      runId: this.state.run.runId,
      status: this.state.run.status,
      progress: this.state.run.progress,
    });
    this.markDirty();
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, module: "production-pipeline", ...payload });
    this.emitEvents?.("product.updated", { action, module: "production-pipeline", ...payload });
  }
  private emitBus(type: string, payload: Record<string, unknown>): void { this.emitEvents?.(type, payload); }
  private markDirty(): void {
    void import("../shell/workspace-state/workspace-state-engine").then(({ workspaceStateEngine }) => {
      workspaceStateEngine.autoSave.markDirty();
    });
  }
  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const productionPipelineEngine = new ProductionPipelineEngine();

export function loadStep3CommandCenterHandoff(): Step3CommandCenterHandoffPayload | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PIPELINE_HANDOFF_KEY) ?? "null") as Step3CommandCenterHandoffPayload | null;
    return raw?.version === 1 && raw.step === "phase-5-step-3-live-command-center" ? raw : null;
  } catch {
    return null;
  }
}
