/**
 * Shared KWIZERA production orchestration — Step 3 + Step 4.
 * Real pipeline progress only; no fabricated percentages or outputs.
 */
import type { ProductionRunState, ProductionStageRow } from "../product-profile/types.js";

export const PRODUCTION_STAGE_MAP: Array<{ id: string; label: string; pipelineStages: string[] }> = [
  { id: "analysis", label: "Product Analysis", pipelineStages: ["validation", "analysis"] },
  { id: "marketing", label: "Marketing Plan", pipelineStages: ["planning"] },
  { id: "story", label: "Story / Script", pipelineStages: ["storyboard"] },
  { id: "scenes", label: "Scene Plan", pipelineStages: ["scene-planning", "asset-preparation"] },
  { id: "video", label: "Video Generation", pipelineStages: ["prompt-generation", "generation"] },
  { id: "audio", label: "Audio", pipelineStages: [] },
  { id: "composition", label: "Composition", pipelineStages: ["rendering"] },
  { id: "quality", label: "Quality Control", pipelineStages: ["review", "export"] },
];

export function emptyProductionState(): ProductionRunState {
  return {
    jobId: null,
    status: "idle",
    progress: 0,
    currentStage: null,
    stages: PRODUCTION_STAGE_MAP.map((s) => ({ id: s.id, label: s.label, status: "pending" })),
    error: null,
    errorStage: null,
    errorCode: null,
    outputUrl: null,
    outputVersion: null,
    outputQuality: null,
    outputDurationSec: null,
    outputValidated: false,
    startedAt: null,
    completedAt: null,
  };
}

export function mapPipelineToProductionStages(
  completedStages: string[],
  activeStage: string | null,
  failed: boolean,
): ProductionStageRow[] {
  return PRODUCTION_STAGE_MAP.map((row) => {
    if (row.pipelineStages.length === 0) {
      const audioDone = completedStages.includes("generation");
      const audioActive = activeStage === "generation";
      let status: ProductionStageRow["status"] = "pending";
      if (failed && audioActive) status = "failed";
      else if (audioDone) status = "completed";
      else if (audioActive) status = "active";
      return { id: row.id, label: row.label, status };
    }
    const done = row.pipelineStages.every((s) => completedStages.includes(s));
    const active = Boolean(activeStage && row.pipelineStages.includes(activeStage));
    let status: ProductionStageRow["status"] = "pending";
    if (failed && active) status = "failed";
    else if (done) status = "completed";
    else if (active) status = "active";
    return { id: row.id, label: row.label, status };
  });
}

export function parsePipelineError(error: string | null): { stage: string | null; code: string | null } {
  if (!error) return { stage: null, code: null };
  const resource = /RESOURCE_UNAVAILABLE/i.test(error);
  const quality = /QUALITY_CONTROL_FAILED/i.test(error);
  const code = resource ? "RESOURCE_UNAVAILABLE"
    : quality ? "QUALITY_CONTROL_FAILED"
      : error.includes(":") ? error.split(":")[0].trim().toUpperCase().replace(/\s+/g, "_")
        : "PIPELINE_ERROR";
  const stageMatch = error.match(/^([A-Z_]+):/);
  return { stage: stageMatch?.[1] ?? null, code };
}

export async function pollPipelineJob(jobId: string): Promise<{
  progress: number;
  stage: string | null;
  status: "running" | "completed" | "failed";
  completedStages: string[];
  error: string | null;
}> {
  const response = await fetch(`/api/autonomous-executions/${encodeURIComponent(jobId)}`);
  if (!response.ok) {
    const history = await fetch("/api/pipeline");
    if (history.ok) {
      const body = await history.json() as {
        history?: Array<{ id: string; progress: number; stage: string; status: string; completedStages: string[]; error?: string }>;
        jobs?: typeof body.history;
      };
      const job = [...(body.jobs ?? []), ...(body.history ?? [])].find((j) => j.id === jobId);
      if (job) {
        return {
          progress: job.progress ?? 0,
          stage: job.stage ?? null,
          status: job.status === "completed" ? "completed" : job.status === "failed" ? "failed" : "running",
          completedStages: job.completedStages ?? [],
          error: job.error ?? null,
        };
      }
    }
    throw new Error("Unable to read production progress");
  }
  const body = await response.json() as {
    job?: { progress: number; stage: string; status: string; completedStages: string[]; error?: string };
  };
  const job = body.job;
  if (!job) throw new Error("Production job not found");
  return {
    progress: job.progress ?? 0,
    stage: job.stage ?? null,
    status: job.status === "completed" ? "completed" : job.status === "failed" ? "failed" : "running",
    completedStages: job.completedStages ?? [],
    error: job.error ?? null,
  };
}

export async function validateProductionOutput(projectId: string): Promise<{
  valid: boolean;
  outputUrl: string | null;
  version: string | null;
  quality: number | null;
  durationSec: number | null;
  format: string | null;
  fileSizeBytes: number | null;
  issues: string[];
}> {
  try {
    const response = await fetch(`/api/production/projects/${encodeURIComponent(projectId)}/output-validation`);
    if (!response.ok) {
      return { valid: false, outputUrl: null, version: null, quality: null, durationSec: null, format: null, fileSizeBytes: null, issues: ["Validation endpoint unavailable"] };
    }
    return await response.json() as Awaited<ReturnType<typeof validateProductionOutput>>;
  } catch {
    return { valid: false, outputUrl: null, version: null, quality: null, durationSec: null, format: null, fileSizeBytes: null, issues: ["Validation request failed"] };
  }
}

export async function persistProductionJob(projectId: string, job: Partial<ProductionRunState> & { jobId: string }): Promise<void> {
  await fetch(`/api/production/projects/${encodeURIComponent(projectId)}/job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
  }).catch(() => null);
}

export async function loadProductionJob(projectId: string): Promise<ProductionRunState | null> {
  try {
    const response = await fetch(`/api/production/projects/${encodeURIComponent(projectId)}/job`);
    if (!response.ok) return null;
    const body = await response.json() as { job?: ProductionRunState | null };
    return body.job ?? null;
  } catch {
    return null;
  }
}

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
    } catch { /* enqueue may have started run */ }
    return { jobId };
  } catch (error) {
    return { jobId: null, error: error instanceof Error ? error.message : "Pipeline unavailable" };
  }
}

export async function fetchProductionArtifacts(projectId: string): Promise<{
  storyboard?: { sceneCount: number; scriptScore?: number };
  scenePlan?: { sceneCount: number; flowScore?: number };
}> {
  try {
    const response = await fetch(`/api/production/projects/${encodeURIComponent(projectId)}/artifacts`);
    if (!response.ok) return {};
    return await response.json() as Awaited<ReturnType<typeof fetchProductionArtifacts>>;
  } catch {
    return {};
  }
}
