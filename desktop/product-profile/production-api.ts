/** Production pipeline API — uses existing Creative Pipeline (KWIZERA AI Core). */

export async function startPipeline(projectId: string): Promise<{ jobId: string | null; error?: string }> {
  try {
    const enqueue = await fetch("/api/pipeline/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const enqueueBody = await enqueue.json() as { job?: { id: string }; error?: string };
    if (!enqueue.ok) {
      return { jobId: null, error: enqueueBody.error ?? "Pipeline enqueue failed — ensure AI Core is running." };
    }
    const jobId = enqueueBody.job?.id ?? null;

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
      /* enqueue may have already started run */
    }

    return { jobId };
  } catch (error) {
    return { jobId: null, error: error instanceof Error ? error.message : "Pipeline unavailable" };
  }
}

export async function ensureProductionDefaults(projectId: string): Promise<void> {
  await fetch(`/api/workspace/projects/${encodeURIComponent(projectId)}/production-defaults`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).catch(() => null);
}
