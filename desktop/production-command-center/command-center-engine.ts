import { workspacePerformanceEngine } from "../shell/performance/performance-engine";
import { collectClientResourceHints } from "../shell/performance/fps-monitor";
import {
  loadStep3CommandCenterHandoff,
  productionPipelineEngine,
} from "../production-pipeline/pipeline-engine";
import type { PipelineState } from "../production-pipeline/types";
import {
  buildAiMeCommandCenterExplanation,
  buildDashboard,
  logCategoryForAction,
  logLevelForAction,
  messageForAction,
} from "./assemble";
import type {
  CommandCenterSnapshot,
  CommandCenterUiPrefs,
  ConnectionState,
  ControlPending,
  LiveProductionState,
  LiveProductionStats,
  LogCategory,
  ProductionLogEntry,
  Step4FinalAssemblyHandoffPayload,
} from "./types";
import {
  COMMAND_CENTER_HANDOFF_KEY,
  COMMAND_CENTER_LOG_KEY,
  COMMAND_CENTER_STORE_KEY,
  DEFAULT_UI_PREFS,
} from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;
type Listener = (snap: CommandCenterSnapshot) => void;

const MAX_LOGS = 500;
const STALE_MS = 8000;

function uid(): string {
  return `log-${Math.random().toString(36).slice(2, 9)}`;
}

function loadPrefs(): CommandCenterUiPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(COMMAND_CENTER_STORE_KEY) ?? "null") as { prefs?: CommandCenterUiPrefs } | null;
    return { ...DEFAULT_UI_PREFS, ...(raw?.prefs ?? {}) };
  } catch {
    return { ...DEFAULT_UI_PREFS };
  }
}

function savePrefs(prefs: CommandCenterUiPrefs): void {
  localStorage.setItem(COMMAND_CENTER_STORE_KEY, JSON.stringify({ version: 1, prefs, updatedAt: new Date().toISOString() }));
}

function loadPersistentLogs(): ProductionLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(COMMAND_CENTER_LOG_KEY) ?? "[]") as ProductionLogEntry[];
  } catch {
    return [];
  }
}

function savePersistentLogs(logs: ProductionLogEntry[]): void {
  localStorage.setItem(COMMAND_CENTER_LOG_KEY, JSON.stringify(logs.slice(-MAX_LOGS)));
}

export class ProductionCommandCenterEngine {
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private prefs: CommandCenterUiPrefs = loadPrefs();
  private logs: ProductionLogEntry[] = loadPersistentLogs();
  private peaks: LiveProductionStats["resourcePeaks"] = { cpu: 0, ram: 0, gpu: 0, vram: 0 };
  private controlPending: ControlPending = "none";
  private connectionState: ConnectionState = "connected";
  private syncWarning = false;
  private lastPipelineUpdate = Date.now();
  private recommendation = "Open Command Center during an active Production Run from Step 2.";
  private pipelineUnsub: (() => void) | null = null;
  private perfUnsub: (() => void) | null = null;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private metrics = collectClientResourceHints();

  setNotify(fn: NotifyFn | null): void { this.notify = fn; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): CommandCenterSnapshot {
    const pipelineSnap = productionPipelineEngine.snapshot();
    const state = pipelineSnap.state;
    const perf = workspacePerformanceEngine.getSnapshot()?.metrics ?? this.metrics;
    const renderFps = perf.fps > 0 ? perf.fps : null;
    const dashboard = buildDashboard(state, perf, this.peaks, {
      controlPending: this.controlPending,
      connectionState: this.connectionState,
      syncWarning: this.syncWarning,
      renderSpeedFps: renderFps,
    });

    return {
      version: 1,
      connected: this.connectionState === "connected",
      connectionState: this.connectionState,
      syncWarning: this.syncWarning,
      controlPending: this.controlPending,
      dashboard,
      logs: this.logs,
      prefs: this.prefs,
      recommendation: this.recommendation,
      step4HandoffReady: Boolean(state),
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    const snap = this.snapshot();
    return {
      connected: snap.connected,
      connectionState: snap.connectionState,
      dashboard: snap.dashboard,
      recommendation: snap.recommendation,
      explanation: buildAiMeCommandCenterExplanation(snap.dashboard, snap.connectionState),
    };
  }

  hydrate(): boolean {
    const handoff = loadStep3CommandCenterHandoff();
    const pipelineLoaded = productionPipelineEngine.hydrate();
    if (!pipelineLoaded && !handoff) {
      this.recommendation = "No Production Run found. Prepare the queue (Step 1) and start production (Step 2).";
      this.connectionState = "lost";
      this.emit();
      return false;
    }
    this.connectionState = "connected";
    this.lastPipelineUpdate = Date.now();
    this.recommendation = handoff
      ? `Monitoring run ${handoff.runId} for ${handoff.projectName}. Step 4 is not started.`
      : "Monitoring active Production Run. Step 4 is not started.";
    this.appendLog("info", "resource", "Command Center connected to Production Pipeline.", undefined, "ProductionRecovered");
    this.writeStep4Handoff();
    this.emit();
    return true;
  }

  mount(): void {
    if (this.pipelineUnsub) return;
    productionPipelineEngine.setAllowHttp(true);
    this.pipelineUnsub = productionPipelineEngine.subscribe((pipeSnap) => {
      this.lastPipelineUpdate = Date.now();
      this.connectionState = "connected";
      if (this.controlPending === "pausing" && pipeSnap.state?.run.status === "PAUSED") this.controlPending = "none";
      if (this.controlPending === "resuming" && pipeSnap.state?.run.status === "RUNNING") this.controlPending = "none";
      if (this.controlPending === "cancelling" && pipeSnap.state?.run.status === "CANCELLED") this.controlPending = "none";
      this.syncWarning = false;
      this.writeStep4Handoff();
      this.emit();
    });
    this.perfUnsub = workspacePerformanceEngine.subscribe((perfSnap) => {
      this.metrics = perfSnap.metrics;
      this.peaks = {
        cpu: Math.max(this.peaks.cpu, perfSnap.metrics.cpuUsage),
        ram: Math.max(this.peaks.ram, perfSnap.metrics.ramUsage),
        gpu: Math.max(this.peaks.gpu, perfSnap.metrics.gpuUsage),
        vram: Math.max(this.peaks.vram, perfSnap.metrics.vramUsage),
      };
      this.emitAction("ResourceUpdated", { cpu: perfSnap.metrics.cpuUsage, gpu: perfSnap.metrics.gpuUsage });
      this.emit();
    });
    this.staleTimer = setInterval(() => this.checkConnection(), 2000);
    if (!productionPipelineEngine.snapshot().state) this.hydrate();
  }

  unmount(): void {
    this.pipelineUnsub?.();
    this.pipelineUnsub = null;
    this.perfUnsub?.();
    this.perfUnsub = null;
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.staleTimer = null;
  }

  setEventHandler(handler: (action: string, payload: Record<string, unknown>) => void): void {
    productionPipelineEngine.setEventEmitter((type, payload) => {
      handler(type, payload);
      const action = typeof payload.action === "string" ? payload.action : type;
      if (action) this.onProductionEvent(action, payload);
    });
  }

  onProductionEvent(action: string, payload: Record<string, unknown>): void {
    const level = logLevelForAction(action);
    const category = logCategoryForAction(action);
    const message = messageForAction(action, payload);
    this.appendLog(level, category, message, typeof payload.taskId === "string" ? payload.taskId : undefined, action);
    if (action === "ProductionStarted") this.notify?.("info", "Production started", message, "updates");
    if (action === "ProductionStageCompleted") this.notify?.("success", "Stage completed", message, "production-complete");
    if (action === "TaskCompleted") this.notify?.("info", "Task completed", message, "information");
    if (action === "TaskFailed") this.notify?.("error", "Task failed", message, "errors");
    if (action === "ProductionPaused") this.notify?.("warning", "Production paused", message, "warnings");
    if (action === "ProductionResumed") this.notify?.("info", "Production resumed", message, "updates");
    if (action === "TaskBlocked") this.notify?.("warning", "Production blocked", message, "warnings");
    if (action === "TaskRetryStarted") this.notify?.("warning", "Retry started", message, "warnings");
    this.writeStep4Handoff();
    this.emit();
  }

  pause(): void {
    this.controlPending = "pausing";
    productionPipelineEngine.pause();
    this.emit();
  }

  async resume(): Promise<void> {
    this.controlPending = "resuming";
    this.emit();
    await productionPipelineEngine.resume();
  }

  cancel(): void {
    this.controlPending = "cancelling";
    productionPipelineEngine.cancel();
    this.emit();
  }

  async retryTask(taskId: string): Promise<void> {
    await productionPipelineEngine.retryTask(taskId);
  }

  selectTask(taskId: string | null): void {
    this.prefs = { ...this.prefs, selectedTaskId: taskId };
    savePrefs(this.prefs);
    this.emit();
  }

  setLogFilter(filter: LogCategory): void {
    this.prefs = { ...this.prefs, logFilter: filter };
    savePrefs(this.prefs);
    this.emit();
  }

  setLogSearch(search: string): void {
    this.prefs = { ...this.prefs, logSearch: search };
    savePrefs(this.prefs);
    this.emit();
  }

  setAutoScroll(autoScrollLogs: boolean): void {
    this.prefs = { ...this.prefs, autoScrollLogs };
    savePrefs(this.prefs);
    this.emit();
  }

  setPauseLogScroll(pauseLogScroll: boolean): void {
    this.prefs = { ...this.prefs, pauseLogScroll };
    savePrefs(this.prefs);
    this.emit();
  }

  clearLogDisplay(): void {
    /* UI-only clear — persistent logs remain until explicit trim on new run */
    this.logs = [];
    this.emit();
  }

  togglePanel(id: string): void {
    this.prefs = {
      ...this.prefs,
      expandedPanels: { ...this.prefs.expandedPanels, [id]: !this.prefs.expandedPanels[id] },
    };
    savePrefs(this.prefs);
    this.emit();
  }

  attemptReconnect(): void {
    this.connectionState = "reconnecting";
    this.emit();
    const ok = productionPipelineEngine.hydrate() || Boolean(loadStep3CommandCenterHandoff());
    this.connectionState = ok ? "connected" : "lost";
    this.lastPipelineUpdate = Date.now();
    if (ok) this.appendLog("success", "resource", "Reconnected to Production Run.", undefined, "ProductionRecovered");
    this.emit();
  }

  getLiveProductionState(): LiveProductionState | null {
    const snap = this.snapshot();
    const state = productionPipelineEngine.snapshot().state;
    if (!snap.dashboard || !state) return null;
    const d = snap.dashboard;
    return {
      version: 1,
      step: "phase-5-step-4-final-assembly",
      productionId: d.productionId,
      runId: d.runId,
      projectId: state.run.projectId,
      projectName: d.projectName,
      overallProgress: d.overallProgress,
      currentStage: d.currentStage,
      currentTaskId: d.currentTaskId,
      currentTaskName: d.currentTaskName,
      queueState: d.queueItems,
      taskStates: state.tasks,
      logs: this.logs,
      eta: d.eta,
      resourceState: d.resources,
      aiState: d.aiEngines,
      workerState: d.workers,
      errors: d.errors,
      warnings: d.warnings,
      checkpoints: d.checkpoints,
      generatedArtifacts: d.artifacts,
      productionStatus: d.status,
      stats: d.stats,
      pipelineState: state,
      preparedAt: new Date().toISOString(),
      note: "Step 4 final assembly/render/export is not auto-started.",
    };
  }

  writeStep4Handoff(): void {
    const live = this.getLiveProductionState();
    if (!live) return;
    const payload: Step4FinalAssemblyHandoffPayload = {
      ...live,
      status: "READY FOR FINAL ASSEMBLY / STEP 4",
    };
    localStorage.setItem(COMMAND_CENTER_HANDOFF_KEY, JSON.stringify(payload));
    void import("../shell/workspace-state/workspace-state-engine").then(({ workspaceStateEngine }) => {
      workspaceStateEngine.autoSave.markDirty();
    });
  }

  private checkConnection(): void {
    const pipe = productionPipelineEngine.snapshot();
    const running = pipe.ticking || pipe.state?.run.status === "RUNNING";
    const stale = Date.now() - this.lastPipelineUpdate > STALE_MS;
    if (running && stale) {
      this.connectionState = "lost";
      this.syncWarning = true;
    } else if (this.connectionState === "reconnecting") {
      /* wait */
    } else if (pipe.state) {
      this.connectionState = "connected";
    }
    this.emit();
  }

  private appendLog(
    level: ProductionLogEntry["level"],
    category: ProductionLogEntry["category"],
    message: string,
    taskId?: string,
    action?: string,
  ): void {
    const entry: ProductionLogEntry = { id: uid(), at: new Date().toISOString(), level, category, message, taskId, action };
    this.logs = [...this.logs, entry].slice(-MAX_LOGS);
    savePersistentLogs(this.logs);
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.onProductionEvent(action, payload);
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }
}

export const productionCommandCenterEngine = new ProductionCommandCenterEngine();

export function loadStep4FinalAssemblyHandoff(): Step4FinalAssemblyHandoffPayload | null {
  try {
    const raw = JSON.parse(localStorage.getItem(COMMAND_CENTER_HANDOFF_KEY) ?? "null") as Step4FinalAssemblyHandoffPayload | null;
    return raw?.version === 1 && raw.step === "phase-5-step-4-final-assembly" ? raw : null;
  } catch {
    return null;
  }
}

export function buildLiveStateFromPipeline(state: PipelineState): LiveProductionState {
  const metrics = collectClientResourceHints();
  const dashboard = buildDashboard(state, metrics, { cpu: 0, ram: 0, gpu: 0, vram: 0 }, {
    controlPending: "none",
    connectionState: "connected",
    syncWarning: false,
    renderSpeedFps: null,
  })!;
  return {
    version: 1,
    step: "phase-5-step-4-final-assembly",
    productionId: dashboard.productionId,
    runId: dashboard.runId,
    projectId: state.run.projectId,
    projectName: dashboard.projectName,
    overallProgress: dashboard.overallProgress,
    currentStage: dashboard.currentStage,
    currentTaskId: dashboard.currentTaskId,
    currentTaskName: dashboard.currentTaskName,
    queueState: dashboard.queueItems,
    taskStates: state.tasks,
    logs: [],
    eta: dashboard.eta,
    resourceState: dashboard.resources,
    aiState: dashboard.aiEngines,
    workerState: dashboard.workers,
    errors: dashboard.errors,
    warnings: dashboard.warnings,
    checkpoints: dashboard.checkpoints,
    generatedArtifacts: dashboard.artifacts,
    productionStatus: dashboard.status,
    stats: dashboard.stats,
    pipelineState: state,
    preparedAt: new Date().toISOString(),
    note: "Step 4 not started.",
  };
}
