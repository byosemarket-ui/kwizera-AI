import type { CustomerWorkflowSummary } from "../../../pmv-workflow/api";

/** Identifies one customer run: a retry or resume starts a new one. */
export function runKey(workflow: Pick<CustomerWorkflowSummary, "workflowId" | "startedAt">): string {
  return `${workflow.workflowId}|${workflow.startedAt ?? ""}`;
}

export function isRunActive(workflow: Pick<CustomerWorkflowSummary, "status"> | null): boolean {
  return workflow?.status === "QUEUED" || workflow?.status === "RUNNING";
}

/**
 * Percentage to display. Within one run it never moves backwards (a quality re-check that
 * re-renders does not rewind the bar, a failure freezes it); a new run starts from its own value.
 */
export function displayPercent(
  previous: { key: string; percent: number } | null,
  workflow: Pick<CustomerWorkflowSummary, "workflowId" | "startedAt" | "delivered" | "progress">,
): { key: string; percent: number } {
  const key = runKey(workflow);
  const reported = Math.max(0, Math.min(100, Math.floor(workflow.progress.percent ?? 0)));
  const capped = workflow.delivered ? reported : Math.min(99, reported);
  if (!previous || previous.key !== key) return { key, percent: capped };
  return { key, percent: Math.min(workflow.delivered ? 100 : 99, Math.max(previous.percent, capped)) };
}

/**
 * Elapsed run time in ms from the server's own start time; null when the start is unknown.
 * `receivedAtMs` / `nowMs` are client clock readings, so only the time since the last response
 * depends on the client clock.
 */
export function elapsedMs(
  workflow: Pick<CustomerWorkflowSummary, "status" | "startedAt" | "completedAt" | "observedAt" | "updatedAt">,
  receivedAtMs: number,
  nowMs: number,
): number | null {
  if (!workflow.startedAt) return null;
  const started = Date.parse(workflow.startedAt);
  if (!Number.isFinite(started)) return null;
  let end: number;
  if (isRunActive(workflow)) {
    const observed = Date.parse(workflow.observedAt);
    if (!Number.isFinite(observed)) return null;
    end = observed + Math.max(0, nowMs - receivedAtMs);
  } else {
    end = Date.parse(workflow.completedAt ?? workflow.updatedAt);
    if (!Number.isFinite(end)) return null;
  }
  return Math.max(0, end - started);
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

/** Customer text for the measured render estimate; null means show no estimate at all. */
export function etaText(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `About ${Math.max(5, Math.round(seconds / 5) * 5)} seconds left`;
  const minutes = Math.round(seconds / 60);
  return minutes <= 1 ? "About 1 minute left" : `About ${minutes} minutes left`;
}

export function activeStageLabel(workflow: Pick<CustomerWorkflowSummary, "stages">): string | null {
  return workflow.stages.find((s) => s.state === "active")?.label ?? null;
}

/** One short line telling the customer what is happening right now. */
export function runStatusLine(workflow: Pick<CustomerWorkflowSummary, "status" | "stages">): string {
  if (workflow.status === "QUEUED") return "Starting…";
  if (workflow.status === "RUNNING") {
    const label = activeStageLabel(workflow);
    return label ? `${label}…` : "Processing…";
  }
  if (workflow.status === "WAITING_FOR_USER") return "Waiting for you";
  if (workflow.status === "FAILED") return "Stopped";
  if (workflow.status === "CANCELLED") return "Cancelled";
  return "Your video is ready";
}
