import type { CustomerWorkflowSummary } from "../../ai/pmv-orchestrator/views";

export type { CustomerWorkflowSummary } from "../../ai/pmv-orchestrator/views";

export type PmvWorkflowAction = "start" | "resume" | "cancel" | "retry";

async function readWorkflow(response: Response): Promise<CustomerWorkflowSummary | null> {
  const body = await response.json().catch(() => ({})) as { workflow?: CustomerWorkflowSummary | null; error?: string };
  if (!response.ok) throw new Error(body.error ?? "Automated production is not available right now");
  return body.workflow ?? null;
}

export async function getPmvWorkflow(projectId: string): Promise<CustomerWorkflowSummary | null> {
  return readWorkflow(await fetch(`/api/pmv/projects/${encodeURIComponent(projectId)}/workflow`));
}

export async function sendPmvWorkflowAction(projectId: string, action: PmvWorkflowAction): Promise<CustomerWorkflowSummary | null> {
  return readWorkflow(await fetch(`/api/pmv/projects/${encodeURIComponent(projectId)}/workflow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  }));
}
