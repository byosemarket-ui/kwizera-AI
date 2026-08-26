/** Phase 5 Step 4 engine — final assembly/render/QC/export over Step 3 live state. */

import { loadStep4FinalAssemblyHandoff } from "../production-command-center/command-center-engine";
import type { LiveProductionState } from "../production-command-center/types";
import { PIPELINE_STORE_KEY } from "../production-pipeline/types";
import type { PipelineState } from "../production-pipeline/types";
import {
  assembleMasterTimeline,
  buildAiMeFinalExplanation,
  buildAudioMix,
  buildHistoryEntry,
  buildOutputPackage,
  buildRenderResult,
  buildThumbnail,
  composeText,
  computeFinalProgress,
  createInitialState,
  emptyRenderProgress,
  makeError,
  markDeferredTasksComplete,
  runAvSync,
  runQualityControl,
  validateFinalInputs,
  validateOutputConfig,
  resolveOutputConfig,
  validateRender,
  validateScenes,
} from "./assemble";
import type {
  FinalizationStage,
  FinalizationState,
  FinalizationUiSnapshot,
  ProductionHistoryEntry,
} from "./types";
import {
  FINAL_HANDOFF_KEY,
  FINAL_HISTORY_KEY,
  FINAL_STORE_KEY,
  PHASE5_COMPLETE_KEY,
} from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;
type Listener = (snap: FinalizationUiSnapshot) => void;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loadStore(): Record<string, FinalizationState> {
  try {
    return JSON.parse(localStorage.getItem(FINAL_STORE_KEY) ?? "{}") as Record<string, FinalizationState>;
  } catch {
    return {};
  }
}

function saveState(state: FinalizationState): void {
  const map = loadStore();
  map[state.projectId] = state;
  localStorage.setItem(FINAL_STORE_KEY, JSON.stringify(map));
}

function loadHistory(): ProductionHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(FINAL_HISTORY_KEY) ?? "[]") as ProductionHistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entry: ProductionHistoryEntry): void {
  const list = loadHistory().filter((h) => !(h.productionId === entry.productionId && h.versionLabel === entry.versionLabel));
  list.unshift(entry);
  localStorage.setItem(FINAL_HISTORY_KEY, JSON.stringify(list.slice(0, 100)));
  // Phase 7 Step 2 — durable production memory (metadata only)
  void import("../persistent-memory/sync-bridge")
    .then(({ syncProductionHistoryToDisk }) => syncProductionHistoryToDisk(list.slice(0, 20) as unknown as Array<Record<string, unknown>>))
    .catch(() => { /* API not ready */ });
}

function patchPipelineStore(pipeline: PipelineState): void {
  try {
    const map = JSON.parse(localStorage.getItem(PIPELINE_STORE_KEY) ?? "{}") as Record<string, { state: PipelineState }>;
    map[pipeline.run.projectId] = { state: pipeline };
    localStorage.setItem(PIPELINE_STORE_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

function nextVersionLabel(projectId: string, productionId: string): { label: string; number: number } {
  const hist = loadHistory().filter((h) => h.projectId === projectId && h.productionId === productionId);
  const number = hist.length + 1;
  return { label: `v1.${number - 1}`, number: number === 1 ? 1 : number };
}

export class ProductionFinalEngine {
  private state: FinalizationState | null = null;
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private recommendation = "Load Live Production State from Command Center (Step 3), then start finalization.";
  private ticking = false;
  private completedStages: FinalizationStage[] = [];
  private abort = false;

  setNotify(fn: NotifyFn | null): void { this.notify = fn; }
  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void { this.emitEvents = fn; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): FinalizationUiSnapshot {
    return {
      version: 1,
      state: this.state,
      recommendation: this.recommendation,
      ticking: this.ticking,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    return {
      running: this.ticking,
      status: this.state?.status ?? "IDLE",
      progress: this.state?.progress ?? 0,
      phase5Complete: Boolean(this.state?.phase5Complete),
      packageId: this.state?.package?.packageId ?? null,
      recommendation: this.recommendation,
      explanation: buildAiMeFinalExplanation(this.state),
    };
  }

  hydrate(): boolean {
    const live = loadStep4FinalAssemblyHandoff();
    if (!live || live.step !== "phase-5-step-4-final-assembly") {
      this.state = null;
      this.recommendation = "No LIVE PRODUCTION STATE found. Complete Phase 5 Step 3 Command Center first.";
      this.emit();
      return false;
    }
    const pipeline = live.pipelineState;
    if (!pipeline) {
      this.recommendation = "Live Production State missing pipelineState — cannot finalize.";
      this.emit();
      return false;
    }

    const stored = loadStore()[live.projectId];
    if (stored && stored.productionId === live.productionId) {
      this.state = stored;
      if (stored.status === "RENDERING" || stored.status === "ASSEMBLING" || stored.status === "EXPORTING" || stored.status === "VALIDATING") {
        this.state = {
          ...stored,
          status: stored.render ? "VALIDATING" : "ASSEMBLING",
          warnings: [...new Set([...stored.warnings, "Recovered interrupted finalization — resume from last checkpoint."])],
        };
        this.recommendation = `Recovered finalization at ${this.state.stage}. Resume when ready.`;
        this.emitAction("ProductionRecovered", { productionId: live.productionId, stage: this.state.stage });
      } else if (stored.status === "COMPLETED") {
        this.recommendation = `Production ${stored.productionId} already COMPLETED (${stored.package?.versionLabel}). Create a new version to re-export.`;
      } else {
        this.recommendation = `Restored finalization state (${stored.status}).`;
      }
      this.persist();
      this.emit();
      return true;
    }

    this.state = createInitialState(live as LiveProductionState, pipeline);
    this.completedStages = [];
    this.recommendation = `Loaded Live Production State for ${live.productionId}. Click START FINALIZATION.`;
    this.persist();
    this.emit();
    return true;
  }

  async start(): Promise<FinalizationState> {
    if (!this.state && !this.hydrate()) throw new Error("Live Production State required");
    if (!this.state) throw new Error("No finalization state");
    if (this.ticking) return this.state;
    if (this.state.status === "COMPLETED" && this.state.package) {
      this.recommendation = "Already completed. Use CREATE NEW VERSION to produce another package.";
      this.emit();
      return this.state;
    }

    this.abort = false;
    this.state.startedAt = this.state.startedAt || new Date().toISOString();
    this.state.status = "ASSEMBLING";
    this.state.stage = "INPUT_VALIDATION";
    this.recommendation = "Final assembly started.";
    this.emitAction("FinalAssemblyStarted", { productionId: this.state.productionId, runId: this.state.runId });
    this.emitBus("rendering.started", { productionId: this.state.productionId });
    this.persist();
    this.emit();
    this.ticking = true;
    try {
      await this.runPipeline();
    } finally {
      this.ticking = false;
      this.persist();
      this.emit();
    }
    return this.state;
  }

  async retryStage(stage?: FinalizationStage): Promise<void> {
    if (!this.state) return;
    const target = stage || this.state.stage;
    this.state.errors = this.state.errors.filter((e) => e.stage !== target);
    if (this.state.status === "QC_FAILED" || this.state.status === "FAILED" || this.state.status === "BLOCKED") {
      this.state.status = "ASSEMBLING";
    }
    this.recommendation = `Retrying from ${target}.`;
    await this.start();
  }

  async createNewVersion(): Promise<FinalizationState> {
    if (!this.state) throw new Error("No state");
    const live = this.state.live;
    const pipeline = this.state.pipelineState;
    this.state = createInitialState(live, pipeline);
    this.completedStages = [];
    this.recommendation = "New version prepared. Start finalization to export v1.x without overwriting prior packages.";
    this.persist();
    this.emit();
    return this.start();
  }

  private async runPipeline(): Promise<void> {
    if (!this.state) return;
    const s = this.state;

    // 1 INPUT VALIDATION
    s.stage = "INPUT_VALIDATION";
    s.inputValidation = validateFinalInputs(s.live, s.pipelineState);
    this.setProgress("INPUT_VALIDATION", 100);
    const blockedInput = s.inputValidation.filter((i) => i.critical && !i.ok);
    if (blockedInput.length) {
      this.fail("INPUT_VALIDATION", `FINALIZATION BLOCKED: ${blockedInput.map((b) => b.label).join(", ")}`, blockedInput.map((b) => b.detail).join("; "));
      return;
    }
    this.markDone("INPUT_VALIDATION");

    // 2 SCENE VALIDATION
    s.stage = "SCENE_VALIDATION";
    s.sceneValidations = validateScenes(s.pipelineState);
    this.setProgress("SCENE_VALIDATION", 100);
    const badScenes = s.sceneValidations.filter((sc) => !sc.ok);
    if (badScenes.length) {
      this.fail("SCENE_VALIDATION", `FINALIZATION BLOCKED — Scene output missing/invalid: ${badScenes.map((b) => b.sceneName).join(", ")}`, "Do not produce a fake final video.");
      return;
    }
    this.markDone("SCENE_VALIDATION");
    this.checkpoint("SCENE_VALIDATION", "All scenes valid");

    // 3 SCENE ASSEMBLY + 4 MASTER TIMELINE
    s.stage = "SCENE_ASSEMBLY";
    this.setProgress("SCENE_ASSEMBLY", 50);
    await delay(12);
    s.timeline = assembleMasterTimeline(s.pipelineState);
    this.setProgress("SCENE_ASSEMBLY", 100);
    this.markDone("SCENE_ASSEMBLY");

    s.stage = "MASTER_TIMELINE";
    if (!s.timeline.valid) {
      this.fail("MASTER_TIMELINE", "Master timeline invalid", s.timeline.notes.join("; "));
      return;
    }
    this.setProgress("MASTER_TIMELINE", 100);
    this.markDone("MASTER_TIMELINE");
    this.emitAction("TimelineAssemblyCompleted", { timelineId: s.timeline.timelineId, durationSec: s.timeline.totalDurationSec });
    this.checkpoint("MASTER_TIMELINE", `Timeline ${s.timeline.totalDurationSec}s`);

    // 5 AV SYNC
    s.stage = "AV_SYNC";
    s.syncChecks = runAvSync(s.timeline, s.pipelineState);
    if (s.syncChecks.some((c) => !c.ok)) {
      this.fail("AV_SYNC", "QUALITY CONTROL FAILURE — synchronization failed", s.syncChecks.filter((c) => !c.ok).map((c) => c.label).join(", "));
      return;
    }
    this.setProgress("AV_SYNC", 100);
    this.markDone("AV_SYNC");

    // 6 AUDIO MIX
    s.stage = "AUDIO_MIX";
    s.audioMix = buildAudioMix(s.pipelineState, s.timeline);
    this.setProgress("AUDIO_MIX", 100);
    this.markDone("AUDIO_MIX");
    this.emitAction("AudioMixCompleted", { mixId: s.audioMix.mixId });

    // 7 TEXT
    s.stage = "TEXT_COMPOSITION";
    s.textComposition = composeText(s.pipelineState, s.timeline);
    if (!s.textComposition.claimsSafe) {
      this.fail("TEXT_COMPOSITION", "EXPORT BLOCKED — unsafe claims in text composition", s.textComposition.notes.join("; "));
      return;
    }
    this.setProgress("TEXT_COMPOSITION", 100);
    this.markDone("TEXT_COMPOSITION");
    this.emitAction("TextCompositionCompleted", { compositionId: s.textComposition.compositionId });

    // 8 VISUAL COMPOSITION + output config
    s.stage = "VISUAL_COMPOSITION";
    const resolved = resolveOutputConfig(s.pipelineState.snapshot.plan.output);
    s.outputConfig = resolved.config;
    s.warnings = [...s.warnings, ...resolved.warnings];
    const cfgChecks = validateOutputConfig(s.outputConfig);
    if (cfgChecks.some((c) => c.critical && !c.ok)) {
      this.fail("VISUAL_COMPOSITION", "BLOCK EXPORT — required output setting unavailable", cfgChecks.filter((c) => !c.ok).map((c) => c.label).join(", "));
      return;
    }
    this.setProgress("VISUAL_COMPOSITION", 100);
    this.markDone("VISUAL_COMPOSITION");

    // 9 FINAL RENDER with real progress ticks
    s.stage = "FINAL_RENDER";
    s.status = "RENDERING";
    this.emitAction("FinalRenderStarted", { productionId: s.productionId });
    const fps = Number.parseInt(String(s.outputConfig.frameRate).replace(/\D/g, ""), 10) || 30;
    const totalFrames = Math.max(1, Math.round(s.timeline.totalDurationSec * fps));
    const resumeFrame = s.renderProgress.checkpointFrame || 0;
    const startFrame = resumeFrame > 0 && resumeFrame < totalFrames ? resumeFrame : 0;
    const t0 = Date.now();
    for (let frame = startFrame; frame <= totalFrames; frame += Math.max(1, Math.ceil(totalFrames / 20))) {
      if (this.abort) return;
      const pct = Math.min(100, Math.round((frame / totalFrames) * 100));
      const elapsed = (Date.now() - t0) / 1000;
      const speed = frame > startFrame && elapsed > 0 ? (frame - startFrame) / elapsed : null;
      const remaining = speed ? Math.round((totalFrames - frame) / speed) : null;
      s.renderProgress = {
        percent: pct,
        frame: Math.min(frame, totalFrames),
        totalFrames,
        speedFps: speed,
        etaSec: remaining,
        checkpointFrame: frame,
      };
      this.setProgress("FINAL_RENDER", pct);
      this.emitAction("FinalRenderProgressUpdated", { ...s.renderProgress });
      this.emitBus("production.progress", { percent: s.progress, label: "Final Render", frame, totalFrames });
      await delay(8);
    }
    s.renderProgress = { percent: 100, frame: totalFrames, totalFrames, speedFps: s.renderProgress.speedFps, etaSec: 0, checkpointFrame: totalFrames };
    const ver = nextVersionLabel(s.projectId, s.productionId);
    s.render = buildRenderResult(s.pipelineState, s.timeline, s.outputConfig, ver.label);
    this.markDone("FINAL_RENDER");
    this.emitAction("FinalRenderCompleted", { renderId: s.render.renderId, path: s.render.outputPath });
    this.checkpoint("FINAL_RENDER", `Rendered ${totalFrames} frames`, totalFrames);

    // 10 RENDER VALIDATION
    s.stage = "RENDER_VALIDATION";
    s.status = "VALIDATING";
    const rv = validateRender(s.render, s.outputConfig);
    this.setProgress("RENDER_VALIDATION", 100);
    if (rv.some((c) => c.critical && !c.ok)) {
      s.render.validationState = "INVALID";
      this.fail("RENDER_VALIDATION", "RENDER INVALID", rv.filter((c) => !c.ok).map((c) => c.label).join(", "));
      return;
    }
    this.markDone("RENDER_VALIDATION");
    this.emitAction("RenderValidationCompleted", { renderId: s.render.renderId, valid: true });

    // 11 QC
    s.stage = "QUALITY_CONTROL";
    this.emitAction("QualityControlStarted", { productionId: s.productionId });
    s.qcReport = runQualityControl({
      pipeline: s.pipelineState,
      timeline: s.timeline,
      render: s.render,
      text: s.textComposition,
      config: s.outputConfig,
    });
    this.setProgress("QUALITY_CONTROL", 100);
    this.emitAction("QualityControlCompleted", { reportId: s.qcReport.reportId, overall: s.qcReport.overall });
    if (s.qcReport.overall !== "PASS") {
      s.status = "QC_FAILED";
      this.fail("QUALITY_CONTROL", "QUALITY CONTROL: FAILED", s.qcReport.blockingReasons.join("; "));
      return;
    }
    this.markDone("QUALITY_CONTROL");

    // 12 THUMBNAIL
    s.stage = "THUMBNAIL";
    this.emitAction("ThumbnailGenerationStarted", { productionId: s.productionId });
    s.thumbnail = buildThumbnail(s.pipelineState, ver.label);
    this.setProgress("THUMBNAIL", 100);
    this.markDone("THUMBNAIL");
    this.emitAction("ThumbnailGenerationCompleted", { thumbnailId: s.thumbnail.thumbnailId });

    // 13 PACKAGE + 14 EXPORT
    s.stage = "OUTPUT_PACKAGING";
    s.status = "EXPORTING";
    s.package = buildOutputPackage({
      pipeline: s.pipelineState,
      render: s.render,
      mix: s.audioMix,
      text: s.textComposition,
      thumb: s.thumbnail,
      qc: s.qcReport,
      versionLabel: ver.label,
      versionNumber: ver.number,
    });
    this.setProgress("OUTPUT_PACKAGING", 100);
    this.markDone("OUTPUT_PACKAGING");

    s.stage = "EXPORT";
    this.emitAction("ExportStarted", { packageId: s.package.packageId });
    this.emitBus("export.started", { packageId: s.package.packageId });
    await delay(10);
    this.setProgress("EXPORT", 100);
    this.markDone("EXPORT");
    this.emitAction("ExportCompleted", { packageId: s.package.packageId });
    this.emitBus("export.completed", { packageId: s.package.packageId });

    // COMPLETE
    s.stage = "COMPLETE";
    s.status = "COMPLETED";
    s.progress = 100;
    s.completedAt = new Date().toISOString();
    s.phase5Complete = true;
    s.pipelineState = markDeferredTasksComplete(s.pipelineState, s.package.packageId);
    patchPipelineStore(s.pipelineState);
    s.historyEntry = buildHistoryEntry(s);
    saveHistory(s.historyEntry);
    localStorage.setItem(FINAL_HANDOFF_KEY, JSON.stringify({
      version: 1,
      status: "PRODUCTION COMPLETE",
      phase5: "COMPLETE",
      package: s.package,
      qc: s.qcReport,
      history: s.historyEntry,
      completedAt: s.completedAt,
    }));
    localStorage.setItem(PHASE5_COMPLETE_KEY, JSON.stringify({
      version: 1,
      phase: 5,
      status: "COMPLETE",
      productionId: s.productionId,
      packageId: s.package.packageId,
      completedAt: s.completedAt,
      note: "Phase 5 complete. Next phase is not started.",
    }));
    this.recommendation = "PRODUCTION COMPLETE — Phase 5 COMPLETE. Next phase is not started.";
    this.emitAction("ProductionCompleted", {
      productionId: s.productionId,
      runId: s.runId,
      finalVideoId: s.package.videoId,
      thumbnailId: s.package.thumbnailId,
      outputPackageId: s.package.packageId,
      qcReportId: s.package.qcReportId,
      completedAt: s.completedAt,
      finalStatus: "COMPLETED",
    });
    this.emitBus("rendering.completed", { productionId: s.productionId });
    this.notify?.("success", "Production complete", `${s.projectName} — ${s.package.versionLabel} QC PASS`, "production-complete");
    this.persist();
    this.emit();
  }

  private fail(stage: FinalizationStage, message: string, detail: string): void {
    if (!this.state) return;
    const err = makeError(stage, message, detail);
    this.state.errors = [...this.state.errors, err];
    this.state.stage = stage;
    if (this.state.status !== "QC_FAILED") this.state.status = message.includes("BLOCK") ? "BLOCKED" : "FAILED";
    this.recommendation = message;
    this.emitAction("ProductionFinalizationFailed", { stage, message, errorClass: err.errorClass });
    this.notify?.("error", "Finalization failed", message, "errors");
    this.persist();
    this.emit();
  }

  private markDone(stage: FinalizationStage): void {
    if (!this.completedStages.includes(stage)) this.completedStages.push(stage);
    if (this.state) {
      this.state.progress = computeFinalProgress(this.completedStages, stage, 100);
      this.state.updatedAt = new Date().toISOString();
      this.persist();
      this.emit();
    }
  }

  private setProgress(stage: FinalizationStage, pct: number): void {
    if (!this.state) return;
    this.state.stage = stage;
    this.state.progress = computeFinalProgress(this.completedStages, stage, pct);
    this.state.updatedAt = new Date().toISOString();
    this.emit();
  }

  private checkpoint(stage: FinalizationStage, note: string, frame: number | null = null): void {
    if (!this.state) return;
    this.state.checkpoints = [...this.state.checkpoints, {
      checkpointId: `fcp-${Math.random().toString(36).slice(2, 7)}`,
      stage,
      frame,
      timestamp: new Date().toISOString(),
      note,
    }];
  }

  private persist(): void {
    if (!this.state) return;
    saveState(this.state);
    void import("../shell/workspace-state/workspace-state-engine").then(({ workspaceStateEngine }) => {
      workspaceStateEngine.autoSave.markDirty();
    });
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, module: "production-final", ...payload });
    this.emitEvents?.("product.updated", { action, module: "production-final", ...payload });
  }

  private emitBus(type: string, payload: Record<string, unknown>): void {
    this.emitEvents?.(type, payload);
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }
}

export const productionFinalEngine = new ProductionFinalEngine();

export function loadPhase5Complete(): { version: 1; status: string; productionId: string; packageId?: string; completedAt?: string } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PHASE5_COMPLETE_KEY) ?? "null") as {
      version: 1; status: string; productionId: string; packageId?: string; completedAt?: string;
    } | null;
    return raw?.version === 1 ? raw : null;
  } catch {
    return null;
  }
}

export interface Phase5CompleteHandoff {
  version: 1;
  status: "PRODUCTION COMPLETE";
  phase5: "COMPLETE";
  package: import("./types").FinalOutputPackage;
  qc: import("./types").QualityControlReport;
  history: import("./types").ProductionHistoryEntry;
  completedAt: string;
}

export function loadFinalCompleteHandoff(): Phase5CompleteHandoff | null {
  try {
    const raw = JSON.parse(localStorage.getItem(FINAL_HANDOFF_KEY) ?? "null") as Phase5CompleteHandoff | null;
    return raw?.version === 1 && raw.status === "PRODUCTION COMPLETE" ? raw : null;
  } catch {
    return null;
  }
}

export function loadFinalizationStore(): Record<string, FinalizationState> {
  try {
    return JSON.parse(localStorage.getItem(FINAL_STORE_KEY) ?? "{}") as Record<string, FinalizationState>;
  } catch {
    return {};
  }
}

export function listProductionHistory(): ProductionHistoryEntry[] {
  return loadHistory();
}
