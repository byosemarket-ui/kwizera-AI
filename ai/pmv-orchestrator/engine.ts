/**
 * Phase 8 — PMV workflow orchestrator.
 * Coordinates existing subsystems through injected step executors. It never runs inference,
 * generation, or rendering itself, never touches credentials, and persists after every transition.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { readJsonSafe, writeJsonAtomic } from "../../storage/safe-json.js";
import { classifyWorkflowError, retryDelayMs } from "./failure.js";
import { buildExecutionPlan, orderedStepIds, type PlanInput } from "./plan.js";
import {
  PMV_WORKFLOW_VERSION,
  type ClassifiedFailure,
  type ExecutionPlan,
  type StepAttempt,
  type WorkflowQaSummary,
  type WorkflowDelivery,
  type WorkflowRecord,
  type WorkflowStatus,
  type WorkflowStepId,
  type WorkflowStepRecord,
} from "./types.js";
import { toCustomerSummary, type CustomerWorkflowSummary } from "./views.js";

export interface WorkflowSnapshot {
  fingerprints: Record<WorkflowStepId, string>;
  planInput: PlanInput;
}

export interface StepExecutionContext {
  workflow: Readonly<WorkflowRecord>;
  step: Readonly<WorkflowStepRecord>;
  fingerprint: string;
  /** Fingerprint recorded the last time this step succeeded (null if never). */
  priorFingerprint: string | null;
  priorRefs: Readonly<Record<string, string | number | boolean | null>>;
  /** True when a repair reset this step, so previous output must not be reused. */
  forced: boolean;
  isCancelled(): boolean;
}

export type StepOutcome =
  | { kind: "COMPLETED"; refs?: Record<string, string | number | boolean | null>; qa?: WorkflowQaSummary; delivery?: WorkflowDelivery }
  | { kind: "REUSED"; refs?: Record<string, string | number | boolean | null>; qa?: WorkflowQaSummary; delivery?: WorkflowDelivery }
  | { kind: "SKIPPED"; reason: string }
  | { kind: "WAITING_FOR_USER"; code: string; message: string; refs?: Record<string, string | number | boolean | null>; qa?: WorkflowQaSummary }
  | { kind: "REPAIR"; rerunFrom: WorkflowStepId; regenerateSceneIds: string[]; repairKey: string; refs?: Record<string, string | number | boolean | null> };

export type StepExecutor = (ctx: StepExecutionContext) => Promise<StepOutcome>;

export interface OrchestratorDeps {
  loadSnapshot(projectId: string): Promise<WorkflowSnapshot>;
  executors: Partial<Record<WorkflowStepId, StepExecutor>>;
  /** Writes the customer-safe summary onto the project (existing project persistence). */
  writeProjectSummary?(projectId: string, summary: CustomerWorkflowSummary): Promise<void>;
  sleep?(ms: number): Promise<void>;
  log?(event: string, data: Record<string, unknown>): void;
}

const DONE: ReadonlySet<string> = new Set(["COMPLETED", "REUSED", "SKIPPED"]);
const ACTIVE: ReadonlySet<WorkflowStatus> = new Set(["QUEUED", "RUNNING"]);
const EXPENSIVE: ReadonlySet<WorkflowStepId> = new Set(["VIDEO_GENERATION", "RENDER", "MEDIA_PREPARATION"]);
/** A step executing this many times in one run means its inputs never settle. */
const MAX_EXECUTIONS_PER_RUN = 6;
const MAX_HISTORY = 30;

function nowIso(): string {
  return new Date().toISOString();
}

export class PmvWorkflowOrchestrator {
  private root = "";
  private deps: OrchestratorDeps | null = null;
  private readonly records = new Map<string, WorkflowRecord>();
  private readonly latestByProject = new Map<string, string>();
  private readonly queue: string[] = [];
  private draining = false;
  private runningId: string | null = null;
  private idle: Promise<void> = Promise.resolve();
  private resolveIdle: (() => void) | null = null;

  async initialize(storageRoot: string, deps: OrchestratorDeps): Promise<void> {
    this.root = path.join(storageRoot, "pmv-orchestrator");
    this.deps = deps;
    await fs.mkdir(path.join(this.root, "workflows"), { recursive: true });
    const entries = await fs.readdir(path.join(this.root, "workflows")).catch(() => [] as string[]);
    for (const name of entries) {
      if (!name.endsWith(".json")) continue;
      const { value } = await readJsonSafe<WorkflowRecord | null>(path.join(this.root, "workflows", name), null);
      if (!value?.id || !value.projectId) continue;
      const record = migrateRecord(value);
      this.records.set(record.id, record);
      const latest = this.latestByProject.get(record.projectId);
      if (!latest || (this.records.get(latest)?.createdAt ?? "") < record.createdAt) {
        this.latestByProject.set(record.projectId, record.id);
      }
    }
    await this.recoverInterrupted();
  }

  /** Workflows that were queued/running when the service stopped resume from their last persisted step. */
  private async recoverInterrupted(): Promise<void> {
    const interrupted = [...this.records.values()]
      .filter((r) => ACTIVE.has(r.status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const record of interrupted) {
      for (const step of record.steps) {
        if (step.status !== "RUNNING") continue;
        const open = step.history[step.history.length - 1];
        if (open && open.finishedAt === null) {
          open.finishedAt = nowIso();
          open.result = "FAILED";
          open.failureClass = "SYSTEM_ERROR";
          open.code = "RESTART_INTERRUPTED";
          open.retryable = true;
        }
        step.status = "PENDING";
      }
      record.status = "QUEUED";
      record.updatedAt = nowIso();
      await this.persist(record);
      this.deps?.log?.("pmv_workflow_recovered", { workflowId: record.id, projectId: record.projectId });
      this.enqueue(record.id);
    }
  }

  getLatest(projectId: string): WorkflowRecord | null {
    const id = this.latestByProject.get(projectId);
    return id ? this.records.get(id) ?? null : null;
  }

  get(workflowId: string): WorkflowRecord | null {
    return this.records.get(workflowId) ?? null;
  }

  list(limit = 100): WorkflowRecord[] {
    return [...this.records.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.max(1, Math.min(500, limit)));
  }

  /** Resolves when the queue has drained (tests and graceful shutdown). */
  whenIdle(): Promise<void> {
    return this.idle;
  }

  /**
   * Start (or resume) production for a project. Never blocks on long operations:
   * the workflow is queued and executed in the background.
   */
  async start(projectId: string): Promise<WorkflowRecord> {
    const deps = this.requireDeps();
    const latest = this.getLatest(projectId);
    if (latest && ACTIVE.has(latest.status)) return latest;
    if (latest && latest.status !== "COMPLETED") return this.resume(projectId);
    const snapshot = await deps.loadSnapshot(projectId);
    const plan = buildExecutionPlan(snapshot.planInput);
    const now = nowIso();
    const seed = latest ?? null;
    const record: WorkflowRecord = {
      workflowVersion: PMV_WORKFLOW_VERSION,
      id: randomUUID(),
      projectId,
      mode: plan.mode,
      generationMode: snapshot.planInput.generationMode,
      pendingRegenerateSceneIds: [],
      forcedSteps: [],
      status: "QUEUED",
      currentStep: null,
      plan,
      steps: stepsForPlan(plan, seed?.steps ?? [], false),
      cancelRequested: false,
      customerMessage: null,
      lastFailure: null,
      qa: null,
      delivery: null,
      repairAttempts: { ...(seed?.repairAttempts ?? {}) },
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.records.set(record.id, record);
    this.latestByProject.set(projectId, record.id);
    await this.persist(record);
    this.enqueue(record.id);
    return record;
  }

  /** Continue a paused / failed / cancelled workflow; completed steps are never redone unless their inputs changed. */
  async resume(projectId: string, opts: { resetAttempts?: boolean } = {}): Promise<WorkflowRecord> {
    const latest = this.getLatest(projectId);
    if (!latest || latest.status === "COMPLETED") return this.start(projectId);
    if (ACTIVE.has(latest.status)) return latest;
    // Re-plan so a changed mode or creative request adds/removes only the affected steps.
    const snapshot = await this.requireDeps().loadSnapshot(projectId);
    const plan = buildExecutionPlan(snapshot.planInput);
    latest.plan = plan;
    latest.mode = plan.mode;
    latest.generationMode = snapshot.planInput.generationMode;
    latest.steps = stepsForPlan(plan, latest.steps, true);
    for (const step of latest.steps) {
      if (!DONE.has(step.status)) {
        step.status = "PENDING";
        step.failure = null;
        if (opts.resetAttempts) step.attempts = 0;
      }
    }
    latest.cancelRequested = false;
    latest.customerMessage = null;
    latest.status = "QUEUED";
    latest.completedAt = null;
    latest.updatedAt = nowIso();
    await this.persist(latest);
    this.enqueue(latest.id);
    return latest;
  }

  retry(projectId: string): Promise<WorkflowRecord> {
    return this.resume(projectId, { resetAttempts: true });
  }

  async cancel(projectId: string): Promise<WorkflowRecord | null> {
    const latest = this.getLatest(projectId);
    if (!latest || (!ACTIVE.has(latest.status) && latest.status !== "WAITING_FOR_USER")) return latest;
    latest.cancelRequested = true;
    latest.updatedAt = nowIso();
    if (latest.status !== "RUNNING") {
      const index = this.queue.indexOf(latest.id);
      if (index >= 0) this.queue.splice(index, 1);
      this.markCancelled(latest);
    }
    await this.persist(latest);
    return latest;
  }

  private markCancelled(record: WorkflowRecord): void {
    for (const step of record.steps) {
      if (step.status === "RUNNING" || step.status === "WAITING_FOR_USER") step.status = "CANCELLED";
    }
    record.status = "CANCELLED";
    record.customerMessage = "Production was cancelled. Completed work is kept.";
    record.completedAt = nowIso();
    record.updatedAt = nowIso();
  }

  private enqueue(id: string): void {
    if (!this.queue.includes(id) && this.runningId !== id) this.queue.push(id);
    if (!this.draining) {
      this.draining = true;
      this.idle = new Promise<void>((resolve) => { this.resolveIdle = resolve; });
      setImmediate(() => void this.drain());
    }
  }

  private async drain(): Promise<void> {
    try {
      while (this.queue.length) {
        const id = this.queue.shift()!;
        const record = this.records.get(id);
        if (!record || record.status !== "QUEUED") continue;
        this.runningId = id;
        try {
          await this.run(record);
        } catch (error) {
          this.fail(record, classifyWorkflowError(error, record.currentStep ?? "PRODUCT_INTELLIGENCE"));
          await this.persist(record).catch(() => undefined);
        } finally {
          this.runningId = null;
        }
      }
    } finally {
      this.draining = false;
      this.resolveIdle?.();
      this.resolveIdle = null;
    }
  }

  private fail(record: WorkflowRecord, failure: ClassifiedFailure): void {
    record.lastFailure = failure;
    record.customerMessage = failure.customerMessage;
    record.status = failure.waitingForUser ? "WAITING_FOR_USER" : "FAILED";
    record.updatedAt = nowIso();
  }

  private async run(record: WorkflowRecord): Promise<void> {
    const deps = this.requireDeps();
    record.status = "RUNNING";
    record.updatedAt = nowIso();
    await this.persist(record);
    const order = orderedStepIds(record.plan);
    const executions = new Map<WorkflowStepId, number>();

    for (;;) {
      if (record.cancelRequested) {
        this.markCancelled(record);
        await this.persist(record);
        return;
      }
      const snapshot = await deps.loadSnapshot(record.projectId);
      this.invalidateChanged(record, snapshot.fingerprints);

      const next = order
        .map((id) => record.steps.find((s) => s.id === id)!)
        .find((s) => !DONE.has(s.status));
      if (!next) break;

      const unmet = next.dependsOn.filter((d) => !DONE.has(record.steps.find((s) => s.id === d)?.status ?? ""));
      if (unmet.length) {
        this.fail(record, classifyWorkflowError(new Error(`dependency ${unmet.join(",")} not satisfied`), next.id));
        await this.persist(record);
        return;
      }

      const count = (executions.get(next.id) ?? 0) + 1;
      executions.set(next.id, count);
      if (count > MAX_EXECUTIONS_PER_RUN) {
        this.fail(record, { ...classifyWorkflowError(null, next.id), code: "WORKFLOW_LOOP_DETECTED", retryable: false });
        await this.persist(record);
        return;
      }

      const stop = await this.executeStep(record, next, snapshot.fingerprints[next.id]);
      if (stop) return;
    }

    const delivery = record.steps.find((s) => s.id === "DELIVERY");
    if (delivery && (delivery.status === "COMPLETED" || delivery.status === "REUSED") && record.qa?.overallStatus === "QA_PASSED") {
      record.status = "COMPLETED";
      record.currentStep = null;
      record.customerMessage = null;
      record.completedAt = nowIso();
    } else {
      this.fail(record, { ...classifyWorkflowError(null, "DELIVERY"), code: "DELIVERY_NOT_REACHED", retryable: false });
    }
    record.updatedAt = nowIso();
    await this.persist(record);
  }

  /** Reset completed steps whose inputs changed; cascade is implicit because fingerprints fold upstream. */
  private invalidateChanged(record: WorkflowRecord, fingerprints: Record<WorkflowStepId, string>): void {
    for (const step of record.steps) {
      if (!DONE.has(step.status) || !step.inputFingerprint) continue;
      if (step.inputFingerprint !== fingerprints[step.id]) {
        step.status = "PENDING";
        step.attempts = 0;
        this.deps?.log?.("pmv_workflow_step_invalidated", { workflowId: record.id, step: step.id });
      }
    }
  }

  /** Returns true when the run must stop (waiting, failed, cancelled). */
  private async executeStep(record: WorkflowRecord, step: WorkflowStepRecord, fingerprint: string): Promise<boolean> {
    const deps = this.requireDeps();
    const executor = deps.executors[step.id];
    if (!executor) {
      this.finishStep(record, step, fingerprint, { kind: "SKIPPED", reason: "NO_EXECUTOR" });
      await this.persist(record);
      return false;
    }

    if (step.id === "DELIVERY") {
      const qaStep = record.steps.find((s) => s.id === "QA");
      const qaPassed = Boolean(qaStep && (qaStep.status === "COMPLETED" || qaStep.status === "REUSED") && record.qa?.overallStatus === "QA_PASSED");
      if (!qaPassed) {
        this.wait(record, step, "QA_GATE", "Quality checks must pass before delivery.");
        await this.persist(record);
        return true;
      }
    }

    const priorFingerprint = step.inputFingerprint;
    const priorRefs = { ...step.artifactRefs };
    const forced = record.forcedSteps.includes(step.id);

    step.attempts += 1;
    step.status = "RUNNING";
    step.startedAt = nowIso();
    step.failure = null;
    record.currentStep = step.id;
    record.updatedAt = nowIso();
    const attempt: StepAttempt = { attempt: step.attempts, startedAt: step.startedAt, finishedAt: null, result: "FAILED" };
    step.history.push(attempt);
    if (step.history.length > MAX_HISTORY) step.history.splice(0, step.history.length - MAX_HISTORY);
    await this.persist(record);

    let outcome: StepOutcome;
    try {
      outcome = await executor({
        workflow: record,
        step,
        fingerprint,
        priorFingerprint,
        priorRefs,
        forced,
        isCancelled: () => record.cancelRequested,
      });
    } catch (error) {
      const failure = classifyWorkflowError(error, step.id);
      attempt.finishedAt = nowIso();
      attempt.result = "FAILED";
      attempt.failureClass = failure.failureClass;
      attempt.code = failure.code;
      attempt.retryable = failure.retryable;
      step.failure = failure;
      deps.log?.("pmv_workflow_step_failed", {
        workflowId: record.id, step: step.id, attempt: step.attempts, failureClass: failure.failureClass, code: failure.code,
      });
      if (record.cancelRequested) {
        attempt.result = "CANCELLED";
        this.markCancelled(record);
        await this.persist(record);
        return true;
      }
      if (failure.retryable && step.attempts < step.maxAttempts) {
        step.status = "PENDING";
        await this.persist(record);
        await (deps.sleep ?? defaultSleep)(retryDelayMs(failure, step.attempts));
        return false;
      }
      step.status = failure.waitingForUser ? "WAITING_FOR_USER" : "FAILED";
      this.fail(record, failure);
      await this.persist(record);
      return true;
    }

    attempt.finishedAt = nowIso();
    if (record.cancelRequested && outcome.kind !== "COMPLETED" && outcome.kind !== "REUSED") {
      attempt.result = "CANCELLED";
      this.markCancelled(record);
      await this.persist(record);
      return true;
    }

    if (outcome.kind === "WAITING_FOR_USER") {
      attempt.result = "WAITING_FOR_USER";
      attempt.code = outcome.code;
      if (outcome.refs) Object.assign(step.artifactRefs, outcome.refs);
      if (outcome.qa) record.qa = outcome.qa;
      this.wait(record, step, outcome.code, outcome.message);
      await this.persist(record);
      return true;
    }

    if (outcome.kind === "REPAIR") {
      attempt.result = "SUCCEEDED";
      step.status = "COMPLETED";
      step.completedAt = nowIso();
      if (outcome.refs) Object.assign(step.artifactRefs, outcome.refs);
      record.repairAttempts[outcome.repairKey] = (record.repairAttempts[outcome.repairKey] ?? 0) + 1;
      record.pendingRegenerateSceneIds = [...new Set(outcome.regenerateSceneIds)];
      const order = orderedStepIds(record.plan);
      const from = order.indexOf(outcome.rerunFrom);
      const reset = order.slice(Math.max(0, from));
      for (const id of reset) {
        const target = record.steps.find((s) => s.id === id)!;
        target.status = "PENDING";
        target.attempts = 0;
      }
      record.forcedSteps = [...new Set([...record.forcedSteps, ...reset.filter((id) => id !== "REPAIR")])];
      record.qa = null;
      await this.persist(record);
      return false;
    }

    attempt.result = outcome.kind === "REUSED" ? "REUSED" : "SUCCEEDED";
    this.finishStep(record, step, fingerprint, outcome);
    await this.persist(record);
    return false;
  }

  private finishStep(
    record: WorkflowRecord,
    step: WorkflowStepRecord,
    fingerprint: string,
    outcome: Extract<StepOutcome, { kind: "COMPLETED" | "REUSED" | "SKIPPED" }>,
  ): void {
    step.status = outcome.kind;
    step.inputFingerprint = fingerprint;
    step.completedAt = nowIso();
    if (outcome.kind === "SKIPPED") {
      step.artifactRefs = { ...step.artifactRefs, skipReason: outcome.reason };
    } else {
      if (outcome.refs) step.artifactRefs = { ...step.artifactRefs, ...outcome.refs };
      if (outcome.qa) record.qa = outcome.qa;
      if (outcome.delivery) record.delivery = outcome.delivery;
    }
    record.forcedSteps = record.forcedSteps.filter((id) => id !== step.id);
    if (step.id === "RENDER" && outcome.kind === "COMPLETED") record.pendingRegenerateSceneIds = [];
    record.updatedAt = nowIso();
  }

  private wait(record: WorkflowRecord, step: WorkflowStepRecord, code: string, message: string): void {
    step.status = "WAITING_FOR_USER";
    record.status = "WAITING_FOR_USER";
    record.customerMessage = message;
    record.lastFailure = null;
    record.updatedAt = nowIso();
    this.deps?.log?.("pmv_workflow_waiting", { workflowId: record.id, step: step.id, code });
  }

  private async persist(record: WorkflowRecord): Promise<void> {
    record.updatedAt = record.updatedAt || nowIso();
    await writeJsonAtomic(path.join(this.root, "workflows", `${record.id}.json`), record);
    const deps = this.deps;
    if (deps?.writeProjectSummary) {
      await deps.writeProjectSummary(record.projectId, toCustomerSummary(record)).catch((error: unknown) => {
        deps.log?.("pmv_workflow_summary_write_failed", {
          workflowId: record.id,
          code: (error as { code?: string })?.code ?? "UNKNOWN",
        });
      });
    }
  }

  private requireDeps(): OrchestratorDeps {
    if (!this.deps) throw new Error("PMV workflow orchestrator is not initialized");
    return this.deps;
  }
}

/**
 * Build step records for a plan, carrying lineage from prior records.
 * keepState=true (resume) keeps statuses/history; false (new run) carries only fingerprints + refs,
 * so executors re-verify artifacts and report REUSED instead of regenerating.
 */
function stepsForPlan(plan: ExecutionPlan, prior: WorkflowStepRecord[], keepState: boolean): WorkflowStepRecord[] {
  return plan.steps.map((planStep) => {
    const previous = prior.find((s) => s.id === planStep.id);
    if (previous && keepState) {
      return { ...previous, dependsOn: planStep.dependsOn, capabilities: planStep.capabilities, reason: planStep.reason };
    }
    const carried = Boolean(previous && DONE.has(previous.status) && previous.inputFingerprint);
    return {
      id: planStep.id,
      status: "PENDING",
      dependsOn: planStep.dependsOn,
      capabilities: planStep.capabilities,
      reason: planStep.reason,
      inputFingerprint: carried ? previous!.inputFingerprint : null,
      attempts: 0,
      maxAttempts: EXPENSIVE.has(planStep.id) ? 2 : 3,
      history: [],
      failure: null,
      artifactRefs: carried ? { ...previous!.artifactRefs } : {},
      startedAt: null,
      completedAt: null,
    };
  });
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Additive, non-destructive migration of persisted workflow records. */
export function migrateRecord(raw: WorkflowRecord): WorkflowRecord {
  const record = { ...raw } as WorkflowRecord;
  record.workflowVersion = typeof raw.workflowVersion === "number" ? raw.workflowVersion : 1;
  record.generationMode = raw.generationMode ?? "EXACT_PRODUCT";
  record.pendingRegenerateSceneIds = Array.isArray(raw.pendingRegenerateSceneIds) ? raw.pendingRegenerateSceneIds : [];
  record.forcedSteps = Array.isArray(raw.forcedSteps) ? raw.forcedSteps : [];
  record.repairAttempts = raw.repairAttempts && typeof raw.repairAttempts === "object" ? raw.repairAttempts : {};
  record.steps = (raw.steps ?? []).map((step) => ({
    ...step,
    history: Array.isArray(step.history) ? step.history : [],
    artifactRefs: step.artifactRefs && typeof step.artifactRefs === "object" ? step.artifactRefs : {},
    attempts: typeof step.attempts === "number" ? step.attempts : 0,
    maxAttempts: typeof step.maxAttempts === "number" ? step.maxAttempts : 3,
  }));
  return record;
}
