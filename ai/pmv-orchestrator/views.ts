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
  progress: { completed: number; total: number };
  stages: Array<{ label: string; state: CustomerStageState }>;
  canResume: boolean;
  canCancel: boolean;
  canRetry: boolean;
  delivered: boolean;
  updatedAt: string;
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

export function toCustomerSummary(record: WorkflowRecord): CustomerWorkflowSummary {
  const order = orderedStepIds(record.plan).filter((id) => id !== "REPAIR" || record.steps.some((s) => s.id === "REPAIR" && s.status === "RUNNING"));
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
    progress: { completed, total: stages.length },
    stages,
    canResume: record.status === "WAITING_FOR_USER" || record.status === "FAILED" || record.status === "CANCELLED",
    canCancel: record.status === "QUEUED" || record.status === "RUNNING" || record.status === "WAITING_FOR_USER",
    canRetry: record.status === "FAILED",
    delivered: record.status === "COMPLETED" && Boolean(record.delivery),
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
