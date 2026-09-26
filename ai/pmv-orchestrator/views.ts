/**
 * Phase 8 — workflow views.
 * Customer view: safe labels and states only (no step ids, capabilities, providers, models, costs, raw errors).
 * Admin view: full orchestration detail plus Admin-routing metadata — still never credentials.
 */
import { orderedStepIds } from "./plan.js";
import { CUSTOMER_STEP_LABELS, type WorkflowRecord, type WorkflowStatus, type WorkflowStepId } from "./types.js";

export type CustomerStageState = "done" | "active" | "pending" | "waiting" | "failed" | "cancelled";

export interface CustomerWorkflowSummary {
  workflowId: string;
  status: WorkflowStatus;
  label: string;
  message: string | null;
  /**
   * `percent` is stage-weighted: finished stages count fully, the active stage counts only its
   * measured render progress. It is 100 only once the video is delivered.
   */
  progress: { completed: number; total: number; percent: number };
  stages: Array<{ label: string; state: CustomerStageState }>;
  /** Measured progress (0–100) of the active stage, or null when that stage reports none. */
  activeStagePercent: number | null;
  /** Seconds left for the active render, only when its measured rate makes that meaningful. */
  etaSeconds: number | null;
  /** Start of the current run; null when unknown (never guessed). */
  startedAt: string | null;
  completedAt: string | null;
  /** Server clock when this summary was built, so elapsed time ignores client clock skew. */
  observedAt: string;
  canResume: boolean;
  canCancel: boolean;
  canRetry: boolean;
  delivered: boolean;
  updatedAt: string;
}

/** Measured state of the render job the active step is waiting on. */
export interface LiveRenderProgress {
  progress: number;
  startedAt: string | null;
}

/** Relative share of each step in the overall bar; steps absent from the plan are ignored. */
function stepWeight(id: WorkflowStepId, generative: boolean): number {
  switch (id) {
    case "PRODUCT_INTELLIGENCE": return 8;
    case "PRODUCT_LOCK": return 2;
    case "CREATIVE_PLANNING": return 10;
    case "MEDIA_PREPARATION": return 2;
    case "VIDEO_GENERATION": return 60;
    case "AUDIO": return 4;
    case "TIMELINE": return 4;
    case "RENDER": return generative ? 5 : 60;
    case "QA": return 8;
    case "DELIVERY": return 2;
    default: return 0;
  }
}

const RENDER_BACKED: ReadonlySet<WorkflowStepId> = new Set(["VIDEO_GENERATION", "RENDER"]);
const ETA_MIN_PROGRESS = 15;
const ETA_MAX_PROGRESS = 95;
const ETA_MIN_ELAPSED_MS = 15_000;

/** Linear estimate from the render job's own measured rate; null whenever that rate is not yet meaningful. */
export function estimateRenderSecondsLeft(live: LiveRenderProgress | null, nowMs: number): number | null {
  if (!live?.startedAt) return null;
  const started = Date.parse(live.startedAt);
  const elapsed = nowMs - started;
  if (!Number.isFinite(started) || elapsed < ETA_MIN_ELAPSED_MS) return null;
  if (live.progress < ETA_MIN_PROGRESS || live.progress > ETA_MAX_PROGRESS) return null;
  const seconds = (elapsed / 1000) * ((100 - live.progress) / live.progress);
  return Math.max(5, Math.ceil(seconds / 5) * 5);
}

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  QUEUED: "Starting production",
  RUNNING: "Producing your video",
  WAITING_FOR_USER: "Waiting for you",
  FAILED: "Production paused",
  CANCELLED: "Production cancelled",
  COMPLETED: "Video delivered",
};

function stageState(status: string): CustomerStageState {
  if (status === "COMPLETED" || status === "REUSED" || status === "SKIPPED") return "done";
  if (status === "RUNNING") return "active";
  if (status === "WAITING_FOR_USER") return "waiting";
  if (status === "FAILED") return "failed";
  if (status === "CANCELLED") return "cancelled";
  return "pending";
}

const STATE_RANK: Record<CustomerStageState, number> = { failed: 5, waiting: 4, active: 3, cancelled: 2, pending: 1, done: 0 };

export function toCustomerSummary(
  record: WorkflowRecord,
  live: LiveRenderProgress | null = null,
  now: Date = new Date(),
): CustomerWorkflowSummary {
  const order = orderedStepIds(record.plan).filter((id) => id !== "REPAIR" || record.steps.some((s) => s.id === "REPAIR" && s.status === "RUNNING"));
  const generative = record.plan.steps.some((s) => s.id === "VIDEO_GENERATION");
  const running = record.status === "RUNNING";
  const activeStep = running && record.currentStep
    ? record.steps.find((s) => s.id === record.currentStep && s.status === "RUNNING") ?? null
    : null;
  const activeLive = activeStep && RENDER_BACKED.has(activeStep.id) && live
    ? { progress: Math.max(0, Math.min(100, Math.round(live.progress))), startedAt: live.startedAt }
    : null;
  let totalWeight = 0;
  let doneWeight = 0;
  for (const id of order) {
    const step = record.steps.find((s) => s.id === id);
    if (!step) continue;
    const weight = stepWeight(id, generative);
    totalWeight += weight;
    const state = stageState(step.status);
    if (state === "done") doneWeight += weight;
    else if (activeLive && step === activeStep) doneWeight += weight * (activeLive.progress / 100);
  }
  const delivered = record.status === "COMPLETED" && Boolean(record.delivery);
  const raw = totalWeight > 0 ? Math.floor((doneWeight / totalWeight) * 100) : 0;
  const percent = delivered ? 100 : Math.min(99, raw);
  const stages: Array<{ label: string; state: CustomerStageState }> = [];
  for (const id of order) {
    const step = record.steps.find((s) => s.id === id);
    if (!step) continue;
    const label = CUSTOMER_STEP_LABELS[id as WorkflowStepId];
    const state = stageState(step.status);
    const existing = stages.find((s) => s.label === label);
    if (!existing) stages.push({ label, state });
    else if (STATE_RANK[state] > STATE_RANK[existing.state]) existing.state = state;
  }
  const completed = stages.filter((s) => s.state === "done").length;
  const current = record.currentStep ? CUSTOMER_STEP_LABELS[record.currentStep] : null;
  const label = record.status === "RUNNING" && current ? current : STATUS_LABEL[record.status];
  return {
    workflowId: record.id,
    status: record.status,
    label,
    message: record.customerMessage,
    progress: { completed, total: stages.length, percent },
    stages,
    activeStagePercent: activeLive ? activeLive.progress : null,
    etaSeconds: estimateRenderSecondsLeft(activeLive, now.getTime()),
    startedAt: record.runStartedAt ?? null,
    completedAt: record.completedAt,
    observedAt: now.toISOString(),
    canResume: record.status === "WAITING_FOR_USER" || record.status === "FAILED" || record.status === "CANCELLED",
    canCancel: record.status === "QUEUED" || record.status === "RUNNING" || record.status === "WAITING_FOR_USER",
    canRetry: record.status === "FAILED",
    delivered,
    updatedAt: record.updatedAt,
  };
}

export interface CapabilityRoutingView {
  capability: string;
  status: string;
  source: string;
  providerId: string | null;
  modelId: string | null;
}

/** Admin observability — orchestration state plus how each requested capability currently routes. */
export function toAdminView(record: WorkflowRecord, describe?: (capability: string) => CapabilityRoutingView | null) {
  const routing = describe
    ? record.plan.requiredCapabilities.map((cap) => describe(cap)).filter((v): v is CapabilityRoutingView => Boolean(v))
    : [];
  return {
    workflowId: record.id,
    workflowVersion: record.workflowVersion,
    projectId: record.projectId,
    mode: record.mode,
    generationMode: record.generationMode,
    status: record.status,
    currentStep: record.currentStep,
    requiredCapabilities: record.plan.requiredCapabilities,
    estimatedOperations: record.plan.estimatedOperations,
    capabilityRouting: routing,
    steps: record.steps.map((s) => ({
      id: s.id,
      status: s.status,
      capabilities: s.capabilities,
      reason: s.reason,
      attempts: s.attempts,
      maxAttempts: s.maxAttempts,
      failure: s.failure ? { failureClass: s.failure.failureClass, code: s.failure.code, retryable: s.failure.retryable, route: s.failure.route } : null,
      history: s.history,
      artifactRefs: s.artifactRefs,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
    })),
    lastFailure: record.lastFailure
      ? { failureClass: record.lastFailure.failureClass, code: record.lastFailure.code, route: record.lastFailure.route, retryable: record.lastFailure.retryable }
      : null,
    qa: record.qa,
    delivery: record.delivery,
    repairAttempts: record.repairAttempts,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
  };
}
