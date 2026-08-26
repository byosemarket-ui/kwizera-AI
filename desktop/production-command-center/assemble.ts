/** Build Command Center views from pipeline + performance state — no duplicate execution. */

import { detectPerformanceAlerts } from "../shell/performance/memory-optimizer";
import type { PerformanceAlert } from "../shell/performance/types";
import type { ExecTask, PipelineStageId, PipelineState, TaskAttempt } from "../production-pipeline/types";
import { STAGE_LABELS } from "../production-pipeline/types";
import type {
  AiEngineCategory,
  AiEngineStatusView,
  AiEngineUiStatus,
  CommandCenterDashboard,
  EtaView,
  LiveProductionStats,
  MetricsInput,
  PipelineNodeStatus,
  PipelineNodeView,
  RecoveryView,
  ResourceHealthLevel,
  ResourceHealthView,
  ResourceMonitorView,
  TaskDetailView,
  TaskQueueItemView,
  WorkerStatusView,
} from "./types";
import { PIPELINE_STAGE_SHORT } from "./types";

const STAGE_ORDER: PipelineStageId[] = [
  "ASSET_PREPARATION",
  "VISUAL_GENERATION",
  "AUDIO_GENERATION",
  "SCENE_PRODUCTION",
  "TIMELINE_ASSEMBLY",
  "FINAL_RENDER",
  "QUALITY_CONTROL",
  "EXPORT",
];

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms < 0 || !Number.isFinite(ms)) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

export function gbFromMb(mb: number | null | undefined): number | null {
  if (mb == null || !Number.isFinite(mb)) return null;
  return Math.round((mb / 1024) * 10) / 10;
}

function healthFromUsage(usage: number | null, warn: number, crit: number): ResourceHealthLevel {
  if (usage == null) return "UNAVAILABLE";
  if (usage >= crit) return "CRITICAL";
  if (usage >= warn) return "WARNING";
  return "GOOD";
}

export function buildResourceHealth(metrics: MetricsInput, alerts: PerformanceAlert[]): ResourceHealthView {
  const hasCritical = (code: string) => alerts.some((a) => a.code.includes(code) && a.severity === "critical");
  const hasWarning = (code: string) => alerts.some((a) => a.code.includes(code));
  return {
    cpu: healthFromUsage(metrics.cpuUsage, 85, 95),
    ram: hasCritical("ram") ? "CRITICAL" : hasWarning("ram") ? "WARNING" : healthFromUsage(metrics.ramUsage, 85, 92),
    gpu: metrics.gpuUsage <= 0 && metrics.source !== "live" ? "UNAVAILABLE" : healthFromUsage(metrics.gpuUsage, 85, 92),
    vram: healthFromUsage(metrics.vramUsage, 85, 90),
    storage: hasCritical("disk") ? "CRITICAL" : hasWarning("disk") ? "WARNING" : healthFromUsage(metrics.diskUsage, 90, 95),
    temperature: "UNAVAILABLE",
  };
}

export function buildResourceMonitor(
  metrics: MetricsInput,
  state: PipelineState | null,
  renderSpeedFps: number | null,
): ResourceMonitorView {
  const alerts = detectPerformanceAlerts(metrics);
  const ramTotal = gbFromMb(metrics.ramTotalMb);
  const ramUsed = gbFromMb(metrics.ramUsedMb);
  const vramTotal = metrics.vramUsage > 0 ? Math.round(((metrics.ramTotalMb || 8192) / 1024) * (metrics.vramUsage / 100) * 10) / 10 : null;
  const artifactBytes = state?.artifacts.length ?? 0;
  return {
    cpuUsage: metrics.cpuUsage ?? null,
    cpuTempC: null,
    cpuFreqMhz: null,
    ramUsedGb: ramUsed,
    ramTotalGb: ramTotal,
    ramUsage: metrics.ramUsage ?? null,
    gpuUsage: metrics.gpuUsage ?? null,
    gpuName: metrics.gpuUsage > 0 ? "Local GPU (detected)" : metrics.source === "heuristic" ? null : "Not available",
    gpuTempC: null,
    vramUsedGb: vramTotal,
    vramTotalGb: ramTotal ? Math.round(ramTotal * 0.5 * 10) / 10 : null,
    vramUsage: metrics.vramUsage ?? null,
    diskFreeGb: metrics.diskTotalGb && metrics.diskUsedGb != null
      ? Math.round((metrics.diskTotalGb - metrics.diskUsedGb) * 10) / 10
      : null,
    diskUsedGb: metrics.diskUsedGb ?? null,
    diskTotalGb: metrics.diskTotalGb ?? null,
    diskUsage: metrics.diskUsage ?? null,
    productionStorageGb: artifactBytes ? Math.round(artifactBytes * 0.05 * 10) / 10 : null,
    renderSpeedFps,
    renderSpeedLabel: renderSpeedFps != null ? `${renderSpeedFps.toFixed(1)} frames/sec` : "N/A",
    alerts,
    health: buildResourceHealth(metrics, alerts),
  };
}

function categoryForEngine(name: string, taskType?: string): AiEngineCategory {
  const n = `${name} ${taskType || ""}`.toUpperCase();
  if (/VISION|ANALYSIS|DETECT/.test(n)) return "VISION";
  if (/VOICE|TTS|SPEECH/.test(n)) return "VOICE";
  if (/AUDIO|MUSIC|SFX/.test(n)) return "AUDIO";
  if (/VIDEO|RENDER|SCENE|TIMELINE|COMPOSITION/.test(n)) return "VIDEO";
  if (/TEXT|SUBTITLE|LLM/.test(n)) return "TEXT";
  return "IMAGE_GENERATION";
}

export function buildAiEngineStatuses(state: PipelineState | null): AiEngineStatusView[] {
  if (!state) return [];
  const categories = new Map<AiEngineCategory, AiEngineStatusView>();
  for (const route of state.routes) {
    const cat = categoryForEngine(route.engineName, route.taskType);
    const running = state.tasks.find(
      (t) => (t.requiredAiEngine === route.engineName || t.taskType === route.taskType)
        && (t.status === "RUNNING" || t.status === "STARTING" || t.status === "VALIDATING"),
    );
    const busy = state.tasks.find(
      (t) => (t.requiredAiEngine === route.engineName || t.taskType === route.taskType)
        && (t.status === "READY" || t.status === "WAITING"),
    );
    let status: AiEngineUiStatus = "READY";
    if (running) status = "RUNNING";
    else if (busy) status = "BUSY";
    else if (route.location === "EXTERNAL" && route.internetRequired) status = "UNAVAILABLE";
    else if (!route.engineName) status = "NOT_CONFIGURED";
    categories.set(cat, {
      category: cat,
      engineName: route.engineName,
      status,
      taskName: running?.taskName ?? busy?.taskName ?? null,
    });
  }
  const order: AiEngineCategory[] = ["VISION", "IMAGE_GENERATION", "VOICE", "AUDIO", "VIDEO", "TEXT"];
  return order.filter((c) => categories.has(c)).map((c) => categories.get(c)!);
}

export function buildWorkerStatuses(state: PipelineState | null, attempts: TaskAttempt[]): WorkerStatusView[] {
  if (!state) return [];
  const workers: WorkerStatusView[] = [];
  for (let i = 0; i < state.run.gpuWorkers; i++) {
    const workerId = `gpu-${String(i + 1).padStart(2, "0")}`;
    const active = state.run.activeWorkerIds.includes(workerId);
    const attempt = attempts.find((a) => a.workerId === workerId && !a.endedAt);
    const task = attempt ? state.tasks.find((t) => t.taskId === attempt.taskId) : null;
    workers.push({
      workerId,
      type: "GPU",
      label: `GPU Worker ${String(i + 1).padStart(2, "0")}`,
      status: active ? "RUNNING" : task ? "BUSY" : "IDLE",
      taskId: task?.taskId ?? null,
      taskName: task?.taskName ?? null,
      progress: task?.progress ?? 0,
    });
  }
  for (let i = 0; i < state.run.cpuWorkers; i++) {
    const workerId = `cpu-${String(i + 1).padStart(2, "0")}`;
    const active = state.run.activeWorkerIds.includes(workerId);
    const attempt = attempts.find((a) => a.workerId === workerId && !a.endedAt);
    const task = attempt ? state.tasks.find((t) => t.taskId === attempt.taskId) : null;
    workers.push({
      workerId,
      type: "CPU",
      label: `CPU Worker ${String(i + 1).padStart(2, "0")}`,
      status: active ? "RUNNING" : task ? "BUSY" : "IDLE",
      taskId: task?.taskId ?? null,
      taskName: task?.taskName ?? null,
      progress: task?.progress ?? 0,
    });
  }
  return workers;
}

function stageNodeStatus(tasks: ExecTask[]): PipelineNodeStatus {
  const inStage = tasks;
  if (!inStage.length) return "WAITING";
  if (inStage.every((t) => t.status === "COMPLETED" || t.status === "SKIPPED" || t.status === "DEFERRED_STEP4")) {
    return inStage.some((t) => t.status === "DEFERRED_STEP4") ? "DEFERRED" : "COMPLETED";
  }
  if (inStage.some((t) => t.status === "RUNNING" || t.status === "STARTING" || t.status === "VALIDATING" || t.status === "RETRYING")) {
    return "RUNNING";
  }
  if (inStage.some((t) => t.status === "FAILED")) return "FAILED";
  if (inStage.some((t) => t.status === "BLOCKED")) return "BLOCKED";
  if (inStage.some((t) => t.status === "READY")) return "READY";
  return "WAITING";
}

export function buildPipelineNodes(state: PipelineState | null): PipelineNodeView[] {
  if (!state) return [];
  return STAGE_ORDER.map((id) => {
    const tasks = state.tasks.filter((t) => t.stage === id);
    return {
      id,
      label: STAGE_LABELS[id],
      shortLabel: PIPELINE_STAGE_SHORT[id],
      status: stageNodeStatus(tasks),
      progress: state.run.stageProgress[id] ?? 0,
    };
  });
}

function taskMarker(task: ExecTask, currentTaskId: string | null): TaskQueueItemView["marker"] {
  if (task.status === "COMPLETED" || task.status === "SKIPPED") return "done";
  if (task.taskId === currentTaskId || task.status === "RUNNING" || task.status === "STARTING" || task.status === "VALIDATING") return "current";
  if (task.status === "FAILED" || task.status === "BLOCKED") return task.status === "FAILED" ? "failed" : "blocked";
  if (task.status === "READY") return "next";
  return "pending";
}

export function buildQueueItems(state: PipelineState | null): TaskQueueItemView[] {
  if (!state) return [];
  return [...state.tasks]
    .sort((a, b) => a.order - b.order)
    .map((t) => ({
      taskId: t.taskId,
      taskName: t.taskName,
      taskType: t.taskType,
      status: t.status,
      progress: t.progress,
      durationMs: t.durationMs ?? null,
      error: t.error,
      isCurrent: t.taskId === state.run.currentTaskId,
      marker: taskMarker(t, state.run.currentTaskId),
    }));
}

export function buildTaskDetail(state: PipelineState | null, taskId: string | null): TaskDetailView | null {
  if (!state || !taskId) return null;
  const task = state.tasks.find((t) => t.taskId === taskId);
  if (!task) return null;
  const attempt = state.attempts.filter((a) => a.taskId === taskId).at(-1);
  const elapsed = task.startedAt
    ? (task.completedAt ? new Date(task.completedAt).getTime() : Date.now()) - new Date(task.startedAt).getTime()
    : null;
  const errors = state.run.errors.filter((e) => e.taskId === taskId);
  return {
    taskId: task.taskId,
    taskType: task.taskType,
    taskName: task.taskName,
    status: task.status,
    progress: task.progress,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    elapsedMs: elapsed,
    etaMs: task.progress > 0 && elapsed ? Math.round((elapsed / task.progress) * (100 - task.progress)) : null,
    dependencies: task.dependencies,
    workerId: attempt?.workerId ?? null,
    engine: task.requiredAiEngine || "Local Pipeline Worker",
    model: task.requiredModel || "—",
    inputs: task.inputs,
    outputs: task.expectedOutputs,
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    errors,
    warnings: task.blockedReason ? [task.blockedReason] : [],
    blockedReason: task.blockedReason,
    artifactIds: task.artifactIds,
  };
}

function avgTaskDuration(tasks: ExecTask[]): number | null {
  const done = tasks.filter((t) => t.durationMs && t.durationMs > 0);
  if (!done.length) return null;
  return done.reduce((s, t) => s + (t.durationMs || 0), 0) / done.length;
}

export function computeEta(state: PipelineState | null): EtaView {
  if (!state) {
    return { status: "unavailable", label: "UNAVAILABLE", remainingMs: null, stageRemainingMs: null, currentTaskRemainingMs: null };
  }

  const current = state.tasks.find((t) => t.taskId === state.run.currentTaskId)
    ?? state.tasks.find((t) => t.status === "RUNNING" || t.status === "STARTING" || t.status === "VALIDATING");
  const remaining = state.tasks.filter(
    (t) => !t.deferredToStep4 && t.status !== "COMPLETED" && t.status !== "SKIPPED" && t.status !== "CANCELLED" && t.status !== "DEFERRED_STEP4",
  );

  if (!remaining.length && state.run.progress >= 100) {
    return { status: "available", label: "00:00", remainingMs: 0, stageRemainingMs: 0, currentTaskRemainingMs: 0 };
  }

  const avg = avgTaskDuration(state.tasks);
  if (!avg && !current) {
    return { status: "calculating", label: "CALCULATING...", remainingMs: null, stageRemainingMs: null, currentTaskRemainingMs: null };
  }

  let currentTaskRemainingMs: number | null = null;
  if (current?.startedAt && current.progress > 5) {
    const elapsed = Date.now() - new Date(current.startedAt).getTime();
    currentTaskRemainingMs = Math.max(0, Math.round((elapsed / current.progress) * (100 - current.progress)));
  } else if (current && avg) {
    currentTaskRemainingMs = Math.round(avg);
  }

  const pendingCount = remaining.filter((t) => t.status !== "RUNNING" && t.status !== "STARTING" && t.status !== "VALIDATING").length;
  const base = avg ?? 3000;
  const remainingMs = Math.round((currentTaskRemainingMs ?? base) + pendingCount * base * 0.85);

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return { status: "unavailable", label: "UNAVAILABLE", remainingMs: null, stageRemainingMs: null, currentTaskRemainingMs };
  }

  return {
    status: avg || current ? "available" : "calculating",
    label: avg || current ? formatDuration(remainingMs) : "CALCULATING...",
    remainingMs,
    stageRemainingMs: current?.stage ? Math.round((100 - (state.run.stageProgress[current.stage] || 0)) / 100 * base * 3) : null,
    currentTaskRemainingMs,
  };
}

export function buildRecoveryView(state: PipelineState | null): RecoveryView {
  if (!state) {
    return { active: false, lastCheckpoint: null, recoveredTasks: 0, remainingTasks: 0, status: "—", note: "" };
  }
  const recovered = state.run.warnings.some((w) => /recovered|re-queued/i.test(w));
  const completed = state.tasks.filter((t) => t.status === "COMPLETED").length;
  const remaining = state.tasks.filter(
    (t) => t.status !== "COMPLETED" && t.status !== "SKIPPED" && t.status !== "CANCELLED" && t.status !== "DEFERRED_STEP4",
  ).length;
  const lastCp = state.checkpoints.at(-1);
  return {
    active: recovered,
    lastCheckpoint: lastCp?.label ?? null,
    recoveredTasks: completed,
    remainingTasks: remaining,
    status: state.run.status === "PAUSED" && recovered ? "RESUMED" : state.run.status,
    note: recovered ? state.run.warnings.find((w) => /recovered/i.test(w)) ?? "Production recovered from prior session." : "",
  };
}

export function buildLiveStats(state: PipelineState | null, peaks: LiveProductionStats["resourcePeaks"], eta: EtaView): LiveProductionStats {
  if (!state) {
    return {
      tasksCompleted: 0,
      tasksFailed: 0,
      retries: 0,
      currentStage: null,
      totalElapsedMs: 0,
      estimatedRemainingMs: null,
      resourcePeaks: peaks,
      artifactCount: 0,
      checkpointCount: 0,
    };
  }
  const elapsed = state.run.startedAt ? Date.now() - new Date(state.run.startedAt).getTime() : 0;
  return {
    tasksCompleted: state.tasks.filter((t) => t.status === "COMPLETED").length,
    tasksFailed: state.tasks.filter((t) => t.status === "FAILED").length,
    retries: state.tasks.reduce((s, t) => s + t.retryCount, 0),
    currentStage: state.run.currentStage,
    totalElapsedMs: elapsed,
    estimatedRemainingMs: eta.remainingMs,
    resourcePeaks: peaks,
    artifactCount: state.artifacts.length,
    checkpointCount: state.checkpoints.length,
  };
}

export function buildDashboard(
  state: PipelineState | null,
  metrics: MetricsInput,
  peaks: LiveProductionStats["resourcePeaks"],
  options: {
    controlPending: CommandCenterDashboard["controlPending"];
    connectionState: CommandCenterDashboard["connectionState"];
    syncWarning: boolean;
    renderSpeedFps: number | null;
  },
): CommandCenterDashboard | null {
  if (!state) return null;

  const eta = computeEta(state);
  const currentTask = state.tasks.find((t) => t.taskId === state.run.currentTaskId)
    ?? state.tasks.find((t) => t.status === "RUNNING" || t.status === "STARTING" || t.status === "VALIDATING");
  const completedTasks = state.tasks.filter((t) => t.status === "COMPLETED").length;
  const totalTasks = state.tasks.filter((t) => t.status !== "DEFERRED_STEP4").length;
  const stageIndex = state.run.currentStage ? STAGE_ORDER.indexOf(state.run.currentStage) + 1 : 0;
  const elapsed = state.run.startedAt ? Date.now() - new Date(state.run.startedAt).getTime() : 0;
  const renderActive = currentTask?.taskType === "VIDEO_RENDER" && (currentTask.status === "RUNNING" || currentTask.status === "VALIDATING");

  return {
    projectName: state.job.projectName,
    productionId: state.run.productionId,
    runId: state.run.runId,
    status: options.controlPending === "pausing" ? "PAUSING..." :
      options.controlPending === "resuming" ? "RESUMING..." :
      options.controlPending === "cancelling" ? "CANCELLING..." :
      state.run.status,
    controlPending: options.controlPending,
    connectionState: options.connectionState,
    syncWarning: options.syncWarning,
    overallProgress: state.run.progress,
    completedTasks,
    totalTasks,
    currentStage: state.run.currentStage,
    currentStageLabel: state.run.currentStage ? STAGE_LABELS[state.run.currentStage] : "—",
    stageProgress: state.run.currentStage ? (state.run.stageProgress[state.run.currentStage] ?? 0) : 0,
    stageIndex,
    stageCount: STAGE_ORDER.length,
    currentTaskId: currentTask?.taskId ?? null,
    currentTaskName: currentTask?.taskName ?? "—",
    currentTaskProgress: currentTask?.progress ?? 0,
    startedAt: state.run.startedAt,
    elapsedLabel: formatDuration(elapsed),
    eta,
    pipelineNodes: buildPipelineNodes(state),
    queueItems: buildQueueItems(state),
    workers: buildWorkerStatuses(state, state.attempts),
    aiEngines: buildAiEngineStatuses(state),
    resources: buildResourceMonitor(metrics, state, renderActive ? options.renderSpeedFps : null),
    recovery: buildRecoveryView(state),
    stats: buildLiveStats(state, peaks, eta),
    errors: state.run.errors,
    warnings: state.run.warnings,
    checkpoints: state.checkpoints,
    artifacts: state.artifacts,
  };
}

export function buildAiMeCommandCenterExplanation(
  dashboard: CommandCenterDashboard | null,
  connectionState: string,
): string {
  if (!dashboard) {
    return "No active Production Run is loaded in the Command Center. Complete Phase 5 Step 1 and start production in Step 2 first.";
  }
  const d = dashboard;
  const eta = d.eta.status === "available" ? `Estimated remaining time is approximately ${d.eta.label}.` : `ETA is ${d.eta.label}.`;
  const running = d.currentTaskName !== "—"
    ? `${d.currentStageLabel} is currently processing ${d.currentTaskName} at ${d.currentTaskProgress}%.`
    : `Production is ${d.status} with no active task right now.`;
  const waiting = d.queueItems.filter((t) => t.status === "WAITING").slice(0, 2);
  const waitNote = waiting.length
    ? ` Waiting example: ${waiting.map((t) => `${t.taskName} (${t.status})`).join("; ")}.`
    : "";
  const res = d.resources;
  const resNote = res.cpuUsage != null
    ? ` CPU ${res.cpuUsage}%, GPU ${res.gpuUsage ?? "N/A"}%, RAM ${res.ramUsage ?? "N/A"}%, storage ${res.diskUsage ?? "N/A"}% healthy threshold.`
    : " Resource metrics unavailable.";
  const alertNote = d.resources.alerts.length
    ? ` ${d.resources.alerts.length} resource alert(s) active.`
    : " No critical resource warning is currently active.";
  return [
    `Production Command Center — ${d.projectName} (${d.productionId}) run ${d.runId}.`,
    `Overall production is ${d.overallProgress}% complete (${d.completedTasks}/${d.totalTasks} tasks).`,
    running,
    eta,
    waitNote,
    resNote + alertNote,
    connectionState === "lost" ? "PRODUCTION CONNECTION LOST — attempting reconnect." : "",
    d.recovery.active ? `Recovered production — last checkpoint: ${d.recovery.lastCheckpoint || "none"}.` : "",
    "Controls delegate to the existing Production Pipeline Engine. Step 4 is not started.",
  ].filter(Boolean).join(" ");
}

export function logCategoryForAction(action: string): Exclude<import("./types").LogCategory, "all"> {
  if (/Render|VIDEO_RENDER|frame/i.test(action)) return "render";
  if (/Resource|Checkpoint|ProductionStage/i.test(action)) return "resource";
  if (/Voice|Audio|Scene|Asset|Task/i.test(action)) return "task";
  if (/Production/i.test(action)) return "info";
  return "ai";
}

export function logLevelForAction(action: string): import("./types").LogLevel {
  if (/Failed|Blocked|Cancelled/.test(action)) return "error";
  if (/Retry|Warning|Paused/.test(action)) return "warning";
  if (/Completed|Generated|Unlocked|Recovered|Resumed|Started/.test(action)) return "success";
  return "info";
}

export function messageForAction(action: string, payload: Record<string, unknown>): string {
  const taskId = typeof payload.taskId === "string" ? payload.taskId : "";
  switch (action) {
    case "ProductionStarted": return "Production started.";
    case "ProductionPaused": return "Production paused.";
    case "ProductionResumed": return "Production resumed.";
    case "ProductionCancelled": return "Production cancelled.";
    case "ProductionRecovered": return "Production recovered from prior session.";
    case "TaskStarted": return taskId ? `Task ${taskId} started.` : "Task started.";
    case "TaskProgressUpdated": return taskId ? `Task ${taskId} progress ${payload.progress ?? "?"}%.` : "Task progress updated.";
    case "TaskValidationStarted": return taskId ? `Validating task ${taskId}.` : "Task validation started.";
    case "TaskCompleted": return taskId ? `Task ${taskId} completed.` : "Task completed.";
    case "TaskFailed": return taskId ? `Task ${taskId} failed: ${payload.error ?? "unknown"}.` : "Task failed.";
    case "TaskRetryStarted": return taskId ? `Retry started for ${taskId} (attempt ${payload.attempt ?? "?"}).` : "Task retry started.";
    case "TaskBlocked": return "Production blocked.";
    case "DependencyUnlocked": return taskId ? `Dependencies unlocked after ${taskId}.` : "Dependencies unlocked.";
    case "CheckpointCreated": return `Checkpoint: ${payload.label ?? payload.checkpointId ?? "created"}.`;
    case "ProductionStageCompleted": return `Stage completed: ${payload.stage ?? "unknown"}.`;
    case "VoiceGenerated": return "Voice artifact generated.";
    case "AudioProcessed": return "Audio processed.";
    case "SceneGenerated": return "Scene generated.";
    case "AssetGenerated": return "Asset generated.";
    case "ResourceUpdated": return "Resource metrics updated.";
    default: return action;
  }
}
