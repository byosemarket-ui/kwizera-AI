import { openProjectApi, getProjectApi, updateProjectApi } from "../product-intake/api";

export async function ensureProjectOpen(projectId: string) {
  try {
    return await openProjectApi(projectId);
  } catch {
    return getProjectApi(projectId);
  }
}

export async function markProjectSettings(
  projectId: string,
  workspaceSettings: Record<string, unknown>,
) {
  return updateProjectApi(projectId, { workspaceSettings });
}

/** Reuse existing Creative Pipeline — enqueue then start via autonomous-executions. */
export async function startPipeline(projectId: string): Promise<{ jobId: string | null; error?: string }> {
  try {
    const enqueue = await fetch("/api/pipeline/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const enqueueBody = await enqueue.json() as { job?: { id: string }; error?: string };
    if (!enqueue.ok) {
      return { jobId: null, error: enqueueBody.error ?? "Pipeline enqueue failed" };
    }
    const jobId = enqueueBody.job?.id ?? null;

    // Prefer existing production launcher (does not duplicate pipeline)
    try {
      const start = await fetch("/api/autonomous-executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (start.ok) {
        const startBody = await start.json() as { job?: { id: string } };
        return { jobId: startBody.job?.id ?? jobId };
      }
    } catch {
      /* enqueue alone is enough for handoff */
    }

    return { jobId };
  } catch (error) {
    return { jobId: null, error: error instanceof Error ? error.message : "Pipeline unavailable" };
  }
}
