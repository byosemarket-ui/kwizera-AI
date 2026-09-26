import type { CustomerWorkflowSummary } from "../../ai/pmv-orchestrator/views";
import type { PmvVideoMode } from "../../ai/pmv-shared/modes";
import type { PmvModeAvailability } from "../../ai/pmv-shared/video-mode-resolver";

export type { CustomerWorkflowSummary } from "../../ai/pmv-orchestrator/views";
export type { PmvModeAvailability } from "../../ai/pmv-shared/video-mode-resolver";

export type PmvWorkflowAction = "start" | "resume" | "cancel" | "retry";

/** A request the backend refused with a customer-safe reason (e.g. unavailable video style). */
export class PmvWorkflowRejectedError extends Error {}

async function readWorkflow(response: Response): Promise<CustomerWorkflowSummary | null> {
  const body = await response.json().catch(() => ({})) as { workflow?: CustomerWorkflowSummary | null; error?: string };
  if ((response.status === 400 || response.status === 409) && body.error) throw new PmvWorkflowRejectedError(body.error);
  if (!response.ok) throw new Error(body.error ?? "Automated production is not available right now");
  return body.workflow ?? null;
}

export async function getPmvWorkflow(projectId: string): Promise<CustomerWorkflowSummary | null> {
  return readWorkflow(await fetch(`/api/pmv/projects/${encodeURIComponent(projectId)}/workflow`));
}

export async function sendPmvWorkflowAction(
  projectId: string,
  action: PmvWorkflowAction,
  mode?: PmvVideoMode,
): Promise<CustomerWorkflowSummary | null> {
  return readWorkflow(await fetch(`/api/pmv/projects/${encodeURIComponent(projectId)}/workflow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mode && action !== "cancel" ? { action, mode } : { action }),
  }));
}

/** Customer-safe availability of the three video modes, decided by the backend. */
export async function fetchPmvVideoModes(): Promise<PmvModeAvailability[]> {
  const response = await fetch("/api/pmv/video-modes");
  const body = await response.json().catch(() => ({})) as { modes?: PmvModeAvailability[] };
  if (!response.ok || !Array.isArray(body.modes)) throw new Error("Video styles are unavailable right now");
  return body.modes;
}
