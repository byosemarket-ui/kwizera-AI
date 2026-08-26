/** Assemble runnable pipeline state from Production Execution Package. */

import type { ProductionExecutionPackage, ProductionTask, TaskType, FailureClass } from "../production-queue/types";
import type {
  EngineRoute,
  ExecTask,
  PipelineArtifact,
  PipelineCheckpoint,
  PipelineStageId,
  PipelineState,
  ProductionRun,
} from "./types";
import { STAGE_WEIGHTS, STEP4_DEFERRED_TYPES } from "./types";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function machineId(): string {
  try {
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 0 : 0;
    return `local-${cores || "na"}`;
  } catch {
    return "local-unknown";
  }
}

export function stageForTask(type: TaskType): PipelineStageId {
  if (type === "ASSET_IMPORT" || type === "ASSET_VALIDATION" || type === "IMAGE_PROCESSING" || type === "BACKGROUND_GENERATION") {
    return "ASSET_PREPARATION";
  }
  if (type === "IMAGE_GENERATION" || type === "VISUAL_GENERATION") return "VISUAL_GENERATION";
  if (type === "VOICE_GENERATION" || type === "MUSIC_GENERATION" || type === "SFX_GENERATION" || type === "AUDIO_PROCESSING") {
    return "AUDIO_GENERATION";
  }
  if (type === "SCENE_BUILD" || type === "TEXT_RENDER" || type === "SUBTITLE_GENERATION") return "SCENE_PRODUCTION";
  if (type === "TIMELINE_ASSEMBLY" || type === "VIDEO_COMPOSITION") return "TIMELINE_ASSEMBLY";
  if (type === "VIDEO_RENDER") return "FINAL_RENDER";
  if (type === "QUALITY_CHECK" || type === "THUMBNAIL_GENERATION") return "QUALITY_CONTROL";
  if (type === "EXPORT") return "EXPORT";
  return "ASSET_PREPARATION";
}

export function weightForTask(type: TaskType): number {
  const stage = stageForTask(type);
  const base = STAGE_WEIGHTS[stage];
  return Math.max(1, Math.round(base / 3));
}

export function isDeferredStep4(type: TaskType): boolean {
  return (STEP4_DEFERRED_TYPES as TaskType[]).includes(type);
}

function defaultEngineFor(type: TaskType): string {
  switch (type) {
    case "VOICE_GENERATION": return "Local Voice Engine";
    case "MUSIC_GENERATION":
    case "SFX_GENERATION":
    case "AUDIO_PROCESSING": return "Local Audio Engine";
    case "IMAGE_PROCESSING":
    case "IMAGE_GENERATION":
    case "BACKGROUND_GENERATION": return "Local Image Engine";
    case "VISUAL_GENERATION": return "Local Visual Engine";
    case "TEXT_RENDER":
    case "SUBTITLE_GENERATION": return "Local Text Engine";
    case "SCENE_BUILD":
    case "TIMELINE_ASSEMBLY":
    case "VIDEO_COMPOSITION": return "Local Video Engine";
    case "VIDEO_RENDER": return "Rendering Engine";
    default: return "Local Pipeline Worker";
  }
}

export function buildEngineRoutes(tasks: ProductionTask[]): EngineRoute[] {
  const seen = new Set<string>();
  const routes: EngineRoute[] = [];
  for (const t of tasks) {
    const name = t.requiredAiEngine || defaultEngineFor(t.taskType);
    const key = `${t.taskType}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({
      taskType: t.taskType,
      engineName: name,
      location: "LOCAL",
      offlineCapable: true,
      internetRequired: false,
      note: "Local-first routing. External services are not used unless already configured and authorized.",
    });
  }
  return routes;
}

export function mapPackageTasks(pkg: ProductionExecutionPackage): ExecTask[] {
  return pkg.taskGraph.map((t) => {
    const deferred = isDeferredStep4(t.taskType);
    let status: ExecTask["status"] = "PENDING";
    if (deferred) status = "DEFERRED_STEP4";
    else if (t.status === "READY") status = "READY";
    else if (t.status === "WAITING") status = "WAITING";
    else if (t.status === "BLOCKED") status = "BLOCKED";
    else if (t.status === "COMPLETED") status = "COMPLETED";
    return {
      ...t,
      status,
      stage: stageForTask(t.taskType),
      weight: weightForTask(t.taskType),
      attempt: 0,
      lastAttemptId: null,
      artifactIds: [],
      cacheHit: false,
      deferredToStep4: deferred,
      progress: 0,
    };
  });
}

export function unlockDependencies(tasks: ExecTask[]): ExecTask[] {
  const byId = new Map(tasks.map((t) => [t.taskId, { ...t }]));
  for (const task of byId.values()) {
    if (task.deferredToStep4 || task.status === "DEFERRED_STEP4") {
      task.status = "DEFERRED_STEP4";
      task.deferredToStep4 = true;
      continue;
    }
    if (task.status === "COMPLETED" || task.status === "SKIPPED" || task.status === "CANCELLED") continue;
    if (task.status === "RUNNING" || task.status === "STARTING" || task.status === "VALIDATING" || task.status === "RETRYING") continue;
    if (task.status === "FAILED" || task.status === "BLOCKED") continue;

    const unmet = task.dependencies.filter((d) => {
      const dep = byId.get(d);
      if (!dep) return true;
      return dep.status !== "COMPLETED" && dep.status !== "SKIPPED";
    });

    const unmetBlocking = unmet.filter((d) => {
      const dep = byId.get(d);
      return dep && !dep.deferredToStep4 && dep.status !== "DEFERRED_STEP4";
    });
    const waitingOnlyOnStep4 = unmet.length > 0 && unmetBlocking.length === 0
      && unmet.every((d) => {
        const dep = byId.get(d);
        return dep && (dep.deferredToStep4 || dep.status === "DEFERRED_STEP4");
      });

    if (waitingOnlyOnStep4) {
      task.status = "DEFERRED_STEP4";
      task.deferredToStep4 = true;
      task.blockedReason = "Waiting for Step 4 final render stage";
    } else if (unmetBlocking.length === 0) {
      task.status = "READY";
      task.blockedReason = null;
    } else {
      task.status = "WAITING";
      task.blockedReason = `Waiting for: ${unmetBlocking.map((id) => byId.get(id)?.taskName || id).join(", ")}`;
    }
  }
  return [...byId.values()].sort((a, b) => a.order - b.order);
}

export function computeWeightedProgress(tasks: ExecTask[]): {
  overall: number;
  stageProgress: Record<PipelineStageId, number>;
} {
  const stages = Object.keys(STAGE_WEIGHTS) as PipelineStageId[];
  const stageProgress = {} as Record<PipelineStageId, number>;

  for (const stage of stages) {
    const inStage = tasks.filter((t) => t.stage === stage && !t.deferredToStep4 && t.status !== "DEFERRED_STEP4");
    if (!inStage.length) {
      stageProgress[stage] = 0;
      continue;
    }
    const totalW = inStage.reduce((s, t) => s + t.weight, 0);
    const doneW = inStage.reduce((s, t) => {
      if (t.status === "COMPLETED" || t.status === "SKIPPED") return s + t.weight;
      if (t.status === "RUNNING" || t.status === "VALIDATING" || t.status === "STARTING") return s + t.weight * (t.progress / 100);
      return s;
    }, 0);
    stageProgress[stage] = totalW ? Math.round((doneW / totalW) * 100) : 100;
  }

  const step2Stages: PipelineStageId[] = [
    "ASSET_PREPARATION", "VISUAL_GENERATION", "AUDIO_GENERATION", "SCENE_PRODUCTION", "TIMELINE_ASSEMBLY",
  ];
  let s2Done = 0;
  let s2Total = 0;
  for (const stage of step2Stages) {
    const inStage = tasks.filter((t) => t.stage === stage && !t.deferredToStep4 && t.status !== "DEFERRED_STEP4");
    if (!inStage.length) continue;
    s2Total += STAGE_WEIGHTS[stage];
    s2Done += STAGE_WEIGHTS[stage] * ((stageProgress[stage] || 0) / 100);
  }
  const overall = s2Total ? Math.round((s2Done / s2Total) * 100) : 0;
  return { overall, stageProgress };
}

export function step2Complete(tasks: ExecTask[]): boolean {
  const actionable = tasks.filter((t) => !t.deferredToStep4 && t.status !== "DEFERRED_STEP4");
  if (!actionable.length) return false;
  return actionable.every((t) => t.status === "COMPLETED" || t.status === "SKIPPED");
}

export function cacheKeyFor(task: ExecTask, snapshotId: string): string {
  return [
    task.taskType,
    task.taskId,
    snapshotId,
    task.requiredAiEngine || "none",
    task.inputs.join("|"),
    task.expectedOutputs.join("|"),
  ].join("::");
}

export function createRun(pkg: ProductionExecutionPackage): ProductionRun {
  const now = new Date().toISOString();
  const emptyStages = Object.fromEntries(
    (Object.keys(STAGE_WEIGHTS) as PipelineStageId[]).map((k) => [k, 0]),
  ) as Record<PipelineStageId, number>;
  return {
    runId: uid("run"),
    productionId: pkg.productionId,
    projectId: pkg.projectId,
    productId: pkg.job.productId,
    snapshotId: pkg.snapshotId,
    jobName: pkg.job.jobName,
    startedAt: now,
    updatedAt: now,
    endedAt: null,
    machineId: machineId(),
    applicationVersion: "kwizera-desktop-0.1.0",
    snapshotVersion: pkg.snapshot.plan.versionLabel,
    status: "IDLE",
    currentTaskId: null,
    currentStage: "ASSET_PREPARATION",
    priority: pkg.priority,
    progress: 0,
    stageProgress: emptyStages,
    pauseRequested: false,
    cancelRequested: false,
    gpuWorkers: 1,
    cpuWorkers: Math.min(4, typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2),
    activeWorkerIds: [],
    warnings: [...pkg.job.warnings],
    errors: [],
  };
}

export function assemblePipelineState(pkg: ProductionExecutionPackage): PipelineState {
  const tasks = unlockDependencies(mapPackageTasks(pkg));
  const run = createRun(pkg);
  const now = new Date().toISOString();
  return {
    version: 1,
    run,
    package: pkg,
    snapshot: pkg.snapshot,
    job: pkg.job,
    tasks,
    artifacts: [],
    attempts: [],
    checkpoints: [],
    routes: buildEngineRoutes(pkg.taskGraph),
    cacheIndex: {},
    readyForStep3: false,
    step2Complete: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function outputPathFor(
  productionId: string,
  kind: string,
  name: string,
  version: string,
): string {
  return `projects/local/production/${productionId}/${kind}/${name}.${version}`;
}

export function validateArtifactBasics(artifact: PipelineArtifact): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  if (!artifact.outputPath) notes.push("Missing output path");
  if (!artifact.engine) notes.push("Missing engine");
  if (!artifact.artifactId) notes.push("Missing artifact id");
  return { ok: notes.length === 0, notes };
}

export function productConsistencyCheck(
  task: ExecTask,
  snapshotProductName: string,
): "OK" | "WARNING" | "FAILED" | "N/A" {
  if (!/VISUAL|IMAGE|SCENE/i.test(task.taskType)) return "N/A";
  if (!snapshotProductName) return "WARNING";
  return "OK";
}

export function classifyPipelineError(message: string): FailureClass {
  const m = message.toLowerCase();
  if (/vram|ram|cpu|disk|storage|resource/.test(m)) return "RESOURCE";
  if (/config|not configured/.test(m)) return "CONFIGURATION";
  if (/engine/.test(m)) return "ENGINE";
  if (/corrupt|empty|output|invalid file/.test(m)) return "OUTPUT";
  if (/missing|asset|input/.test(m)) return "INPUT";
  if (/depend/.test(m)) return "DEPENDENCY";
  if (/timeout|temporary|busy|network/.test(m)) return "TRANSIENT";
  return "SYSTEM";
}

export function maybeCheckpoint(label: string, state: PipelineState): PipelineCheckpoint | null {
  const ids = state.tasks.filter((t) => t.status === "COMPLETED").map((t) => t.taskId);
  if (!ids.length) return null;
  return {
    checkpointId: uid("cp"),
    runId: state.run.runId,
    label,
    completedTaskIds: ids,
    artifactIds: state.artifacts.map((a) => a.artifactId),
    timestamp: new Date().toISOString(),
    state: state.run.status,
  };
}

export function buildAiMePipelineExplanation(state: PipelineState): string {
  const running = state.tasks.filter((t) => t.status === "RUNNING" || t.status === "STARTING" || t.status === "VALIDATING");
  const done = state.tasks.filter((t) => t.status === "COMPLETED");
  const failed = state.tasks.filter((t) => t.status === "FAILED");
  const waiting = state.tasks.filter((t) => t.status === "WAITING" || t.status === "READY");
  const deferred = state.tasks.filter((t) => t.status === "DEFERRED_STEP4" || t.deferredToStep4);
  const next = state.tasks.find((t) => t.status === "READY");
  return [
    `Production run ${state.run.runId} for job ${state.run.productionId} is ${state.run.status} at ${state.run.progress}% (Step 2 weighted).`,
    running.length
      ? `Currently running: ${running.map((t) => t.taskName).join(", ")}.`
      : "No task is actively executing right now.",
    `${done.length} completed, ${waiting.length} ready/waiting, ${failed.length} failed, ${deferred.length} deferred to Step 4 (final render/export).`,
    next ? `Next ready task: ${next.taskName} (${next.taskType}) via ${next.requiredAiEngine || "Local Pipeline Worker"}.` : "No READY tasks pending in Step 2.",
    failed.length ? `Failures: ${failed.map((t) => `${t.taskName}: ${t.error || "unknown"}`).join("; ")}.` : "",
    `Artifacts registered: ${state.artifacts.length}. Checkpoints: ${state.checkpoints.length}.`,
    state.readyForStep3
      ? "Step 2 complete — READY FOR LIVE COMMAND CENTER / NEXT PIPELINE STAGE. Step 3 is not started."
      : "Step 2 still in progress. Final VIDEO_RENDER remains Step 4.",
  ].filter(Boolean).join(" ");
}
