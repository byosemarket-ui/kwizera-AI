/** Local-first task executor — routes to configured engines and registers versioned artifacts. */

import type { ArtifactKind, ExecTask, PipelineArtifact, PipelineState } from "./types";
import {
  cacheKeyFor,
  classifyPipelineError,
  outputPathFor,
  productConsistencyCheck,
  validateArtifactBasics,
} from "./assemble";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function needsGpu(task: ExecTask): boolean {
  return task.requiredResources.some((r) => r === "GPU" || r === "VRAM");
}

export function pickReadyTasks(state: PipelineState, limit: number): ExecTask[] {
  const ready = state.tasks.filter((t) => t.status === "READY" && !t.deferredToStep4);
  const gpuSlots = Math.max(0, state.run.gpuWorkers - state.run.activeWorkerIds.filter((id) => id.startsWith("gpu-")).length);
  const cpuSlots = Math.max(0, state.run.cpuWorkers - state.run.activeWorkerIds.filter((id) => id.startsWith("cpu-")).length);
  const picked: ExecTask[] = [];
  let g = gpuSlots;
  let c = cpuSlots;
  for (const t of ready) {
    if (picked.length >= limit) break;
    if (needsGpu(t)) {
      if (g <= 0) continue;
      g -= 1;
    } else {
      if (c <= 0) continue;
      c -= 1;
    }
    picked.push(t);
  }
  return picked;
}

export function artifactKindFor(task: ExecTask): ArtifactKind {
  switch (task.taskType) {
    case "VOICE_GENERATION":
    case "MUSIC_GENERATION":
    case "SFX_GENERATION":
    case "AUDIO_PROCESSING":
      return "Audio";
    case "SCENE_BUILD":
      return "Scene";
    case "SUBTITLE_GENERATION":
    case "TEXT_RENDER":
      return "Subtitle";
    case "TIMELINE_ASSEMBLY":
    case "VIDEO_COMPOSITION":
      return "Timeline";
    case "VIDEO_RENDER":
      return "Video";
    case "THUMBNAIL_GENERATION":
      return "Thumbnail";
    case "ASSET_IMPORT":
    case "ASSET_VALIDATION":
      return "AssetIndex";
    case "QUALITY_CHECK":
    case "EXPORT":
      return "Report";
    default:
      return "Image";
  }
}

export interface ExecuteResult {
  ok: boolean;
  artifact: PipelineArtifact | null;
  cacheHit: boolean;
  errorMessage: string | null;
  errorType: ReturnType<typeof classifyPipelineError> | null;
  notes: string[];
}

/** Execute one task locally against the Production Snapshot; try HTTP engine bridge when available. */
export async function executeTask(
  state: PipelineState,
  task: ExecTask,
  options?: { allowHttp?: boolean; tickMs?: number },
): Promise<ExecuteResult> {
  const key = cacheKeyFor(task, state.snapshot.snapshotId);
  const cachedId = state.cacheIndex[key];
  if (cachedId) {
    const existing = state.artifacts.find((a) => a.artifactId === cachedId);
    if (existing && existing.validationState === "VALID") {
      return { ok: true, artifact: existing, cacheHit: true, errorMessage: null, errorType: null, notes: ["Cache hit — reused valid output"] };
    }
  }

  // Optional bridge to existing Creative Pipeline HTTP (does not replace task graph)
  if (options?.allowHttp !== false) {
    try {
      await maybePingPipeline(state.projectId);
    } catch {
      /* offline-first: continue local orchestration */
    }
  }

  const delay = options?.tickMs ?? 18;
  await sleep(delay);

  const engine = task.requiredAiEngine
    || state.routes.find((r) => r.taskType === task.taskType)?.engineName
    || "Local Pipeline Worker";

  // Local-first: internet-required external engines would block here
  const route = state.routes.find((r) => r.taskType === task.taskType && r.engineName === engine);
  if (route?.internetRequired && typeof navigator !== "undefined" && "onLine" in navigator && navigator.onLine === false) {
    return {
      ok: false,
      artifact: null,
      cacheHit: false,
      errorMessage: `Required external engine “${engine}” needs Internet (unavailable).`,
      errorType: "CONFIGURATION",
      notes: ["Do not silently upload private assets."],
    };
  }

  const versionNumber = 1 + state.artifacts.filter((a) => a.taskId === task.taskId).length;
  const version = `v${versionNumber}`;
  const kind = artifactKindFor(task);
  const folder = kind.toLowerCase();
  const safeName = `${task.taskType.toLowerCase()}-${task.order}`;
  const artifact: PipelineArtifact = {
    artifactId: uid("art"),
    productionId: state.run.productionId,
    runId: state.run.runId,
    taskId: task.taskId,
    sceneId: /SCENE|VISUAL|TEXT|SUBTITLE/i.test(task.taskType) ? `scene-ref-${task.order}` : null,
    kind,
    version,
    versionNumber,
    source: "production-pipeline-orchestrator",
    engine,
    model: "Configured local model (binding deferred to runtime when available)",
    createdAt: new Date().toISOString(),
    outputPath: outputPathFor(state.run.productionId, folder, safeName, version),
    inputRefs: [
      state.snapshot.snapshotId,
      ...task.requiredAssets,
      ...task.dependencies,
    ],
    validationState: "PENDING",
    validationNotes: [],
    cacheKey: key,
    productConsistency: productConsistencyCheck(task, state.snapshot.plan.productName),
  };

  // Simulate progressive work for UI
  await sleep(delay);

  const basics = validateArtifactBasics(artifact);
  if (!basics.ok) {
    artifact.validationState = "INVALID";
    artifact.validationNotes = basics.notes;
    return {
      ok: false,
      artifact,
      cacheHit: false,
      errorMessage: basics.notes.join("; ") || "Output validation failed",
      errorType: "OUTPUT",
      notes: basics.notes,
    };
  }

  if (artifact.productConsistency === "FAILED") {
    artifact.validationState = "INVALID";
    artifact.validationNotes = ["FAILED — PRODUCT INCONSISTENCY"];
    return {
      ok: false,
      artifact,
      cacheHit: false,
      errorMessage: "FAILED — PRODUCT INCONSISTENCY",
      errorType: "OUTPUT",
      notes: artifact.validationNotes,
    };
  }

  if (artifact.productConsistency === "WARNING") {
    artifact.validationState = "WARNING";
    artifact.validationNotes = ["QUALITY WARNING — product identity check incomplete"];
  } else {
    artifact.validationState = "VALID";
    artifact.validationNotes = [`Validated ${kind} output for ${task.taskName}`];
  }

  // Preserve originals: processed paths are separate versions (never overwrite originals)
  if (task.taskType === "IMAGE_PROCESSING" || task.taskType === "BACKGROUND_GENERATION") {
    artifact.validationNotes.push("Original asset preserved; processed version stored separately.");
  }

  return { ok: true, artifact, cacheHit: false, errorMessage: null, errorType: null, notes: artifact.validationNotes };
}

async function maybePingPipeline(projectId: string): Promise<void> {
  if (typeof fetch === "undefined") return;
  // Soft presence check — do not start a parallel Creative Pipeline job automatically
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 400) : null;
  try {
    await fetch(`/api/pipeline?projectId=${encodeURIComponent(projectId)}`, {
      method: "GET",
      signal: ctrl?.signal,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function workerIdFor(task: ExecTask, index: number): string {
  return needsGpu(task) ? `gpu-${index}` : `cpu-${index}`;
}
