/**
 * STEP 4 engine — consumes STEP 3 handoff and drives real video production.
 */

import { MODE_COPY } from "../../ai/video-production/production-mode-types.js";
import { platformPreview } from "../video-requirements/platform-map.js";
import { resolveBoundProject, readScopedHandoff } from "../product-creation/workflow";
import {
  createVideoProject,
  getVideoJob,
  getVideoOutputDetails,
  getVideoProject,
  startVideoRender,
  type VideoProject,
  type VideoRenderJob,
} from "../video-production/api";
import { STEP4_HANDOFF_KEY, type Step4HandoffPayload } from "../video-style/types";

export type ProductionUiStage =
  | "idle"
  | "initializing"
  | "creating-timeline"
  | "queued"
  | "preparing"
  | "rendering"
  | "validating"
  | "registering"
  | "completed"
  | "failed";

export interface ProductionStageItem {
  id: string;
  label: string;
  minProgress: number;
}

export const PRODUCTION_STAGES: ProductionStageItem[] = [
  { id: "preparing-project", label: "Preparing project", minProgress: 0 },
  { id: "validating-data", label: "Validating product data", minProgress: 5 },
  { id: "preparing-images", label: "Preparing selected images", minProgress: 10 },
  { id: "building-plan", label: "Building scene plan", minProgress: 14 },
  { id: "creating-scenes", label: "Creating scenes", minProgress: 25 },
  { id: "generating-motion", label: "Generating product motion", minProgress: 45 },
  { id: "composing", label: "Composing video", minProgress: 65 },
  { id: "adding-text", label: "Adding text & commercial info", minProgress: 75 },
  { id: "rendering", label: "Rendering final video", minProgress: 82 },
  { id: "validating-output", label: "Validating final output", minProgress: 92 },
  { id: "complete", label: "Video ready", minProgress: 100 },
];

export interface FinalProductionContext {
  handoff: Step4HandoffPayload;
  productName: string;
  styleLabel: string;
  platformLabel: string;
  formatLabel: string;
  durationSeconds: number;
  language: string;
  priceLabel: string | null;
  discountLabel: string | null;
  heroUrl: string | null;
  sceneCount: number;
}

export interface FinalReviewSnapshot {
  context: FinalProductionContext | null;
  uiStage: ProductionUiStage;
  progress: number;
  currentStageLabel: string;
  job: VideoRenderJob | null;
  video: VideoProject | null;
  outputUrl: string | null;
  error: string | null;
  busy: boolean;
  started: boolean;
}

type Listener = (snap: FinalReviewSnapshot) => void;

function modeLabel(mode: Step4HandoffPayload["productionMode"]): string {
  return MODE_COPY[mode]?.label ?? mode.replace(/_/g, " ");
}

function buildContext(handoff: Step4HandoffPayload): FinalProductionContext {
  const preview = platformPreview(handoff.platformId);
  return {
    handoff,
    productName: handoff.productName,
    styleLabel: handoff.styleLabel ?? modeLabel(handoff.productionMode),
    platformLabel: handoff.platformLabel ?? preview.label,
    formatLabel: handoff.formatLabel ?? `${preview.width} × ${preview.height}`,
    durationSeconds: handoff.durationSeconds,
    language: handoff.language ?? "English",
    priceLabel: handoff.priceLabel ?? null,
    discountLabel: handoff.discountLabel ?? null,
    heroUrl: handoff.heroAssetId
      ? `/api/workspace/projects/${handoff.projectId}/images/${handoff.heroAssetId}`
      : null,
    sceneCount: handoff.sceneCount,
  };
}

function stageFromJob(job: VideoRenderJob | null, busy: boolean, started: boolean): ProductionUiStage {
  if (!started && busy) return "initializing";
  if (!job) return started ? "idle" : "idle";
  if (job.status === "queued") return "queued";
  if (job.status === "failed") return "failed";
  if (job.status === "completed") return "completed";
  switch (job.stage) {
    case "preparing": return "preparing";
    case "rendering":
    case "processing":
    case "encoding": return "rendering";
    case "validating": return "validating";
    case "registering": return "registering";
    default: return "queued";
  }
}

function stageLabel(job: VideoRenderJob | null, uiStage: ProductionUiStage, progress: number): string {
  if (uiStage === "initializing") return "Initializing production…";
  if (uiStage === "creating-timeline") return "Building timeline from approved plan…";
  if (uiStage === "completed") return "Video ready";
  if (uiStage === "failed") return job?.error ?? "Production failed";
  if (job?.stage) {
    const match = PRODUCTION_STAGES.find((s) => s.minProgress <= (job.progress ?? progress));
    return match?.label ?? job.stage;
  }
  const match = PRODUCTION_STAGES.find((s) => s.minProgress <= progress);
  return match?.label ?? "Preparing…";
}

export class FinalReviewEngine {
  private context: FinalProductionContext | null = null;
  private video: VideoProject | null = null;
  private job: VideoRenderJob | null = null;
  private uiStage: ProductionUiStage = "idle";
  private progress = 0;
  private error: string | null = null;
  private busy = false;
  private started = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): FinalReviewSnapshot {
    const progress = this.job?.progress ?? (this.uiStage === "completed" ? 100 : this.progress);
    return {
      context: this.context,
      uiStage: this.uiStage,
      progress,
      currentStageLabel: stageLabel(this.job, this.uiStage, progress),
      job: this.job,
      video: this.video,
      outputUrl: this.video?.output?.url ?? null,
      error: this.error,
      busy: this.busy,
      started: this.started,
    };
  }

  async hydrate(): Promise<void> {
    const handoff = readScopedHandoff<Step4HandoffPayload>(STEP4_HANDOFF_KEY);
    if (!handoff?.projectId) {
      this.context = null;
      this.emit();
      return;
    }
    this.context = buildContext(handoff);
    try {
      const payload = await getVideoProject(handoff.projectId);
      this.video = payload.video;
      if (payload.video?.activeJobId) {
        const current = await getVideoJob(handoff.projectId, payload.video.activeJobId);
        this.job = current.job;
        this.uiStage = stageFromJob(this.job, false, true);
        this.started = true;
        if (this.job.status === "queued" || this.job.status === "processing") {
          this.startPolling(handoff.projectId);
        }
      } else if (payload.video?.output?.url && payload.video.renderState === "completed") {
        this.uiStage = "completed";
        this.started = true;
        this.progress = 100;
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unable to load production state";
    }
    this.emit();
  }

  async startProduction(): Promise<void> {
    if (this.busy || !this.context) return;
    const { projectId } = this.context.handoff;
    this.busy = true;
    this.error = null;
    this.uiStage = "initializing";
    this.progress = 2;
    this.emit();

    try {
      const bound = await resolveBoundProject();
      if (!bound || bound.projectId !== projectId) {
        throw new Error("Active project does not match the production handoff.");
      }

      let payload = await getVideoProject(projectId);
      this.video = payload.video;

      if (!this.video?.timeline?.length) {
        this.uiStage = "creating-timeline";
        this.progress = 8;
        this.emit();
        const created = await createVideoProject(projectId);
        this.video = created.video;
      }

      if (this.video?.output?.url && this.video.renderState === "completed" && this.video.outputStatus === "CURRENT") {
        this.uiStage = "completed";
        this.progress = 100;
        this.started = true;
        return;
      }

      const activeId = this.video?.activeJobId;
      if (activeId) {
        const current = await getVideoJob(projectId, activeId);
        this.job = current.job;
        if (this.job.status === "queued" || this.job.status === "processing") {
          this.started = true;
          this.uiStage = stageFromJob(this.job, false, true);
          this.startPolling(projectId);
          return;
        }
        if (this.job.status === "completed" && this.video?.output?.url) {
          this.uiStage = "completed";
          this.progress = 100;
          this.started = true;
          return;
        }
      }

      this.uiStage = "queued";
      this.progress = 12;
      this.emit();
      const result = await startVideoRender(projectId, "standard");
      this.video = result.video;
      this.job = result.job;
      this.started = true;
      this.uiStage = stageFromJob(this.job, false, true);
      this.startPolling(projectId);
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Video production failed to start";
      this.uiStage = "failed";
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  async retryProduction(): Promise<void> {
    this.job = null;
    this.uiStage = "idle";
    this.progress = 0;
    this.error = null;
    await this.startProduction();
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private startPolling(projectId: string): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.pollJob(projectId);
    }, 1500);
  }

  private async pollJob(projectId: string): Promise<void> {
    const jobId = this.job?.id ?? this.video?.activeJobId;
    if (!jobId) return;
    try {
      const result = await getVideoJob(projectId, jobId);
      this.job = result.job;
      this.uiStage = stageFromJob(this.job, this.busy, this.started);
      this.progress = this.job.progress ?? this.progress;

      if (this.job.status === "completed" || this.job.status === "failed") {
        this.stopPolling();
        const payload = await getVideoProject(projectId);
        this.video = payload.video;
        if (this.job.status === "completed") {
          this.uiStage = "completed";
          this.progress = 100;
          if (payload.video?.output) {
            try {
              await getVideoOutputDetails(projectId);
            } catch {
              // non-blocking
            }
          }
        } else {
          this.uiStage = "failed";
          this.error = this.job.error ?? "Video production failed";
        }
      }
      this.emit();
    } catch {
      // keep polling
    }
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }
}

export const finalReviewEngine = new FinalReviewEngine();

export function stageCompletion(progress: number, minProgress: number): "done" | "active" | "pending" {
  if (progress >= 100) return "done";
  if (progress >= minProgress + 8) return "done";
  if (progress >= minProgress) return "active";
  return "pending";
}
