import { loadPhase5ProductionHandoff } from "../production-plan/plan-engine";
import type { Phase5ProductionHandoffPayload, ProductionSnapshot } from "../production-plan/types";
import { collectClientResourceHints } from "../shell/performance/fps-monitor";
import {
  assembleProductionJob,
  buildAiMeQueueExplanation,
  nextProductionId,
} from "./assemble";
import type {
  JobPriority,
  PrepStage,
  ProductionExecutionPackage,
  ProductionJob,
  ProductionQueueSnapshot,
  QueueProgress,
} from "./types";
import {
  PREP_STAGE_LABELS,
  PREP_STAGES,
  QUEUE_COUNTER_KEY,
  QUEUE_HANDOFF_KEY,
  QUEUE_MEMORY_KEY,
  QUEUE_STORE_KEY,
} from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;
type Listener = (snap: ProductionQueueSnapshot) => void;

interface StoreEntry {
  current: ProductionJob;
  history: ProductionJob[];
  executionPackage: ProductionExecutionPackage | null;
  snapshot: ProductionSnapshot;
}

function loadStore(): Record<string, StoreEntry> {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_STORE_KEY) ?? "{}") as Record<string, StoreEntry>;
  } catch {
    return {};
  }
}

function saveEntry(entry: StoreEntry): void {
  const map = loadStore();
  map[entry.current.projectId] = entry;
  localStorage.setItem(QUEUE_STORE_KEY, JSON.stringify(map));
}

function loadMemory(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_MEMORY_KEY) ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function saveMemory(projectId: string, payload: Record<string, unknown>): void {
  const mem = loadMemory();
  mem[projectId] = { ...payload, updatedAt: new Date().toISOString() };
  localStorage.setItem(QUEUE_MEMORY_KEY, JSON.stringify(mem));
}

function readCounter(): number {
  try {
    const n = Number(localStorage.getItem(QUEUE_COUNTER_KEY) ?? "0");
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function bumpCounter(): number {
  const next = readCounter() + 1;
  localStorage.setItem(QUEUE_COUNTER_KEY, String(next));
  return next;
}

function emptyProgress(): QueueProgress {
  return { total: PREP_STAGES.length, completed: 0, percent: 0, currentLabel: "Idle", currentStage: null, running: false };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class ProductionQueueEngine {
  private job: ProductionJob | null = null;
  private historyJobs: ProductionJob[] = [];
  private executionPackage: ProductionExecutionPackage | null = null;
  private handoff: Phase5ProductionHandoffPayload | null = null;
  private productionSnapshot: ProductionSnapshot | null = null;
  private progress = emptyProgress();
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private handoffReady = false;
  private recommendation = "Confirm Master Production Plan (Phase 4 Step 3), then prepare the Production Queue.";
  private resumeStageIndex = 0;
  private aiCoreOnline = true;

  setNotify(fn: NotifyFn | null): void { this.notify = fn; }
  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void { this.emitEvents = fn; }
  setAiCoreOnline(online: boolean): void { this.aiCoreOnline = online; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): ProductionQueueSnapshot {
    return {
      version: 1,
      job: this.job,
      executionPackage: this.executionPackage,
      progress: { ...this.progress },
      recommendation: this.recommendation,
      handoffReady: this.handoffReady,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    if (this.progress.running) {
      return { running: true, explanation: `Preparing production queue — ${this.progress.percent}%. ${this.progress.currentLabel}`, recommendation: this.recommendation };
    }
    if (!this.job) {
      return { running: false, explanation: "No Production Job yet. Confirm the Master Production Plan first.", recommendation: this.recommendation };
    }
    return {
      projectId: this.job.projectId,
      productionId: this.job.productionId,
      status: this.job.status,
      overall: this.job.readiness.overall,
      readyForStep2: this.job.readyForStep2,
      running: false,
      recommendation: this.recommendation,
      explanation: buildAiMeQueueExplanation(this.job),
    };
  }

  hydrate(): boolean {
    const handoff = loadPhase5ProductionHandoff();
    this.handoff = handoff;
    this.productionSnapshot = handoff?.snapshot ?? null;
    if (!handoff?.snapshot || !handoff.phase4Complete) {
      this.recommendation = "No confirmed Production Snapshot found. Complete Phase 4 Step 3 first.";
      this.emit();
      return false;
    }
    const stored = loadStore()[handoff.projectId];
    if (stored?.current) {
      if (stored.current.status === "RUNNING") {
        // Step 1 must never leave jobs RUNNING from preparation
        stored.current.status = stored.current.readyForStep2 ? "READY" : "PREPARING";
        saveEntry(stored);
      }
      this.job = { ...stored.current, recoveryState: "restored" };
      this.historyJobs = stored.history ?? [];
      this.executionPackage = stored.executionPackage;
      this.productionSnapshot = stored.snapshot ?? handoff.snapshot;
      this.handoffReady = Boolean(stored.executionPackage);
      this.recommendation = stored.current.status === "READY"
        ? `Restored Production Job ${stored.current.productionId} — READY TO EXECUTE. Step 2 is not started.`
        : `Restored Production Job ${stored.current.productionId} (${stored.current.status}).`;
      this.emitAction("ProductionJobCreated", { restored: true, productionId: stored.current.productionId });
      this.emit();
      return true;
    }
    this.recommendation = `Ready to prepare Production Job from snapshot ${handoff.snapshot.snapshotId}. Generation will not start.`;
    this.emit();
    return true;
  }

  findActiveDuplicate(snapshotId: string, projectId: string): ProductionJob | null {
    const entry = loadStore()[projectId];
    if (!entry?.current) return null;
    const j = entry.current;
    if (j.snapshotId === snapshotId && (j.status === "READY" || j.status === "PREPARING" || j.status === "QUEUED" || j.status === "VALIDATING" || j.status === "BLOCKED")) {
      return j;
    }
    return null;
  }

  async prepare(options?: { forceNewVersion?: boolean; priority?: JobPriority }): Promise<ProductionJob> {
    if (!this.productionSnapshot) {
      if (!this.hydrate()) throw new Error("Confirmed Production Snapshot required");
    }
    if (this.progress.running) throw new Error("Preparation already running");

    const snap = this.productionSnapshot!;
    const existing = this.findActiveDuplicate(snap.snapshotId, snap.plan.projectId);
    if (existing && !options?.forceNewVersion) {
      this.job = existing;
      this.recommendation = `ACTIVE PRODUCTION JOB EXISTS: ${existing.productionId}. View existing job or create a new version explicitly.`;
      this.emitAction("ProductionJobCreated", { duplicate: true, productionId: existing.productionId });
      this.notify?.("warning", "Active job exists", `${existing.productionId} already uses this snapshot.`, "warnings");
      this.emit();
      return existing;
    }

    const previous = options?.forceNewVersion
      ? (this.job?.status === "READY" || this.job?.userConfirmedReady ? this.job : this.historyJobs.find((j) => j.status === "READY") ?? this.job)
      : (this.job?.snapshotId === snap.snapshotId ? this.job : null);

    this.progress = { total: PREP_STAGES.length, completed: 0, percent: 4, currentLabel: PREP_STAGE_LABELS.loaded, currentStage: "loaded", running: true };
    this.resumeStageIndex = 0;
    this.emitAction("ProductionJobCreated", { projectId: snap.plan.projectId, preparing: true });
    this.emitBus("product-analysis.started", { phase: "production-queue" });
    this.emit();

    let hints: Awaited<ReturnType<typeof collectClientResourceHints>> | null = null;
    try {
      hints = await collectClientResourceHints();
    } catch {
      hints = null;
    }

    const productionId = nextProductionId(bumpCounter());
    let assembled: ProductionJob;
    try {
      assembled = assembleProductionJob({
        snapshot: snap,
        previous: previous ?? null,
        productionId,
        priority: options?.priority ?? previous?.priority ?? "NORMAL",
        resourceHints: hints && hints.diskTotalGb > 0 ? {
          cores: hints.cores,
          deviceMemoryGb: hints.deviceMemoryGb,
          jsHeapMb: hints.jsHeapMb,
          diskUsedGb: hints.diskUsedGb,
          diskTotalGb: hints.diskTotalGb,
        } : hints ? {
          cores: hints.cores,
          deviceMemoryGb: hints.deviceMemoryGb,
          jsHeapMb: hints.jsHeapMb,
          diskUsedGb: null,
          diskTotalGb: null,
        } : null,
        aiCoreOnline: this.aiCoreOnline,
      });
      if (existing && options?.forceNewVersion) {
        assembled.duplicateOf = existing.productionId;
        if (previous) this.historyJobs = [...this.historyJobs, previous];
      }
      assembled.status = assembled.status === "BLOCKED" ? "BLOCKED" : "VALIDATING";
      this.job = assembled;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Preparation failed";
      this.progress.running = false;
      this.recommendation = `Preparation failed: ${msg}`;
      this.emit();
      throw error;
    }

    this.emitAction("ProductionSnapshotValidated", {
      valid: assembled.validation.valid,
      blocking: assembled.validation.blocking,
    });

    for (let i = 1; i < PREP_STAGES.length - 1; i++) {
      const stage = PREP_STAGES[i]!;
      this.progress.currentStage = stage;
      this.progress.currentLabel = PREP_STAGE_LABELS[stage];
      this.progress.completed = i + 1;
      this.progress.percent = Math.round(((i + 1) / PREP_STAGES.length) * 94);
      this.resumeStageIndex = i;
      this.emitSection(stage, assembled);
      this.emitBus("production.progress", { percent: this.progress.percent, label: this.progress.currentLabel });
      saveMemory(assembled.projectId, { productionId: assembled.productionId, stage, percent: this.progress.percent, status: "preparing" });
      this.emit();
      await delay(10);
    }

    // Finalize READY / BLOCKED — never RUNNING
    if (assembled.validation.valid && assembled.status !== "BLOCKED") {
      assembled.status = "READY";
      assembled.readyForStep2 = true;
    } else {
      assembled.status = "BLOCKED";
      assembled.readyForStep2 = false;
    }
    assembled.updatedAt = new Date().toISOString();
    this.job = assembled;

    let execPkg: ProductionExecutionPackage | null = null;
    if (assembled.status === "READY") {
      execPkg = this.buildExecutionPackage(assembled, snap);
      this.executionPackage = execPkg;
      localStorage.setItem(QUEUE_HANDOFF_KEY, JSON.stringify(execPkg));
      this.handoffReady = true;
      this.emitAction("ProductionJobReady", { productionId: assembled.productionId });
      this.emitAction("ProductionJobPrepared", { productionId: assembled.productionId, tasks: assembled.totalTasks });
    } else {
      this.executionPackage = null;
      this.handoffReady = false;
      this.emitAction("ProductionJobBlocked", { productionId: assembled.productionId, reason: assembled.errorState });
    }

    this.persist();
    saveMemory(assembled.projectId, {
      productionId: assembled.productionId,
      stage: "saved",
      percent: 100,
      status: assembled.status,
    });
    this.progress = {
      total: PREP_STAGES.length,
      completed: PREP_STAGES.length,
      percent: 100,
      currentLabel: PREP_STAGE_LABELS.saved,
      currentStage: "saved",
      running: false,
    };
    this.recommendation = assembled.status === "READY"
      ? `Production Job ${assembled.productionId} is READY TO EXECUTE. Phase 5 Step 2 is not started.`
      : `Production Job ${assembled.productionId} is BLOCKED: ${assembled.errorState}`;
    this.emitBus("product-analysis.completed", { projectId: assembled.projectId, phase: "production-queue", productionId: assembled.productionId });
    this.markDirty();
    this.emit();
    return assembled;
  }

  setPriority(priority: JobPriority): void {
    if (!this.job || this.job.status === "RUNNING" || this.job.status === "COMPLETED") return;
    this.job = {
      ...this.job,
      priority,
      tasks: this.job.tasks.map((t) => ({ ...t, priority })),
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    this.emit();
  }

  cancelJob(): void {
    if (!this.job) return;
    if (this.job.status === "COMPLETED" || this.job.status === "RUNNING") return;
    this.job = { ...this.job, status: "CANCELLED", readyForStep2: false, updatedAt: new Date().toISOString() };
    this.executionPackage = null;
    this.handoffReady = false;
    this.recommendation = `Production Job ${this.job.productionId} cancelled.`;
    this.persist();
    this.emit();
  }

  markReadyAcknowledged(): void {
    if (!this.job || this.job.status !== "READY") return;
    this.job = { ...this.job, userConfirmedReady: true, updatedAt: new Date().toISOString() };
    if (this.productionSnapshot) {
      this.executionPackage = this.buildExecutionPackage(this.job, this.productionSnapshot);
      localStorage.setItem(QUEUE_HANDOFF_KEY, JSON.stringify(this.executionPackage));
      this.handoffReady = true;
    }
    this.persist();
    this.recommendation = `READY TO EXECUTE acknowledged for ${this.job.productionId}. Step 2 is not started.`;
    this.emit();
  }

  private buildExecutionPackage(job: ProductionJob, snapshot: ProductionSnapshot): ProductionExecutionPackage {
    const dependencies: Record<string, string[]> = {};
    for (const t of job.tasks) dependencies[t.taskId] = [...t.dependencies];
    return {
      version: 1,
      step: "phase-5-step-2-pipeline-engine",
      productionId: job.productionId,
      projectId: job.projectId,
      projectName: job.projectName,
      snapshotId: job.snapshotId,
      job,
      snapshot,
      taskGraph: job.tasks,
      executionQueue: job.executionOrder,
      dependencies,
      requiredAssets: job.assetChecks,
      requiredAiEngines: job.engines,
      resourceRequirements: job.resources,
      priority: job.priority,
      retryPolicy: { defaultMaxRetries: 3, note: "Do not retry permanent configuration errors endlessly." },
      recoveryState: job.recoveryState,
      readiness: job.readiness,
      packageVersion: job.versionLabel,
      preparedAt: new Date().toISOString(),
      note: "Phase 5 Step 2 must consume this package. Do not start generation from Step 1.",
    };
  }

  private persist(): void {
    if (!this.job || !this.productionSnapshot) return;
    saveEntry({
      current: this.job,
      history: this.historyJobs,
      executionPackage: this.executionPackage,
      snapshot: this.productionSnapshot,
    });
    this.markDirty();
  }

  private emitSection(stage: PrepStage, job: ProductionJob): void {
    const payload = { productionId: job.productionId, stage, projectId: job.projectId };
    if (stage === "tasks") {
      for (const t of job.tasks) this.emitAction("ProductionTaskCreated", { taskId: t.taskId, type: t.taskType, ...payload });
    } else if (stage === "dependencies") {
      this.emitAction("ProductionDependencyResolved", { tasks: job.totalTasks, ...payload });
    } else if (stage === "assets") {
      this.emitAction("ProductionAssetChecked", { count: job.assetChecks.length, ...payload });
      const missing = job.assetChecks.filter((a) => a.status === "MISSING" || a.status === "INVALID");
      if (missing.length) this.emitAction("ProductionAssetMissing", { count: missing.length, ...payload });
      for (const t of job.tasks.filter((x) => x.status === "BLOCKED")) {
        this.emitAction("ProductionTaskBlocked", { taskId: t.taskId, reason: t.blockedReason, ...payload });
      }
      for (const t of job.tasks.filter((x) => x.status === "READY")) {
        this.emitAction("ProductionTaskReady", { taskId: t.taskId, ...payload });
      }
    } else if (stage === "engines") {
      this.emitAction("AIEngineChecked", { engines: job.engines.map((e) => e.name), ...payload });
    } else if (stage === "resources") {
      this.emitAction("ResourceCheckCompleted", { items: job.resources.length, ...payload });
    } else if (stage === "queue") {
      this.emitAction("ProductionQueueCreated", { order: job.executionOrder.length, ...payload });
    }
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, module: "production-queue", ...payload });
    this.emitEvents?.("product.updated", { action, module: "production-queue", ...payload });
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

export const productionQueueEngine = new ProductionQueueEngine();

export function loadStep2PipelineHandoff(): ProductionExecutionPackage | null {
  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_HANDOFF_KEY) ?? "null") as ProductionExecutionPackage | null;
    return raw?.version === 1 && raw.step === "phase-5-step-2-pipeline-engine" ? raw : null;
  } catch {
    return null;
  }
}
