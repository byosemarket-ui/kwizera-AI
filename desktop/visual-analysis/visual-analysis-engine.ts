import { loadProductionPackage } from "../product-validation/validation-engine";
import type { ProductionInputPackage } from "../product-validation/types";
import { ORG_STORE_KEY } from "../image-organization/types";
import type { ProductImageSet } from "../image-organization/types";
import { assembleVisualPackage } from "./analyze";
import type { ServerImageProfile, ServerProductIntel } from "./analyze";
import { fetchImageIntelligence, fetchProductIntelligence } from "./api";
import type {
  AnalysisProgress,
  AnalysisStage,
  ImageVisualResult,
  ReviewStatus,
  Step2DeepIntelHandoffPayload,
  VisualAnalysisSnapshot,
  VisualProductAnalysisPackage,
} from "./types";
import { ANALYSIS_STAGES, STAGE_LABELS, VISUAL_HANDOFF_KEY, VISUAL_STORE_KEY } from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;

type Listener = (snap: VisualAnalysisSnapshot) => void;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadStore(): Record<string, VisualProductAnalysisPackage> {
  try {
    return JSON.parse(localStorage.getItem(VISUAL_STORE_KEY) ?? "{}") as Record<string, VisualProductAnalysisPackage>;
  } catch {
    return {};
  }
}

function savePackage(pkg: VisualProductAnalysisPackage): void {
  const map = loadStore();
  map[pkg.projectId] = pkg;
  localStorage.setItem(VISUAL_STORE_KEY, JSON.stringify(map));
}

function loadOrgSet(projectId: string): ProductImageSet | null {
  try {
    const map = JSON.parse(localStorage.getItem(ORG_STORE_KEY) ?? "{}") as Record<string, ProductImageSet>;
    return map[projectId] ?? null;
  } catch {
    return null;
  }
}

function emptyProgress(): AnalysisProgress {
  return {
    total: 0,
    completed: 0,
    percent: 0,
    currentFile: null,
    currentStage: null,
    statusLabel: "Idle",
    running: false,
    stagePercents: {},
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class VisualAnalysisEngine {
  private pkg: VisualProductAnalysisPackage | null = null;
  private productionPackage: ProductionInputPackage | null = null;
  private progress = emptyProgress();
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;
  private handoffReady = false;
  private serviceAvailable = true;
  private recommendation = "Confirm Phase 2 Production Input Package, then start AI Visual Analysis.";
  private resumeCursor = 0;

  setNotify(fn: NotifyFn | null): void {
    this.notify = fn;
  }

  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void {
    this.emitEvents = fn;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): VisualAnalysisSnapshot {
    return {
      version: 1,
      package: this.pkg,
      progress: { ...this.progress, stagePercents: { ...this.progress.stagePercents } },
      recommendation: this.recommendation,
      handoffReady: this.handoffReady,
      serviceAvailable: this.serviceAvailable,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    const p = this.pkg;
    const prog = this.progress;
    if (!p && !prog.running) {
      return {
        explanation: "AI Visual Product Analysis has not started. Load the Phase 2 Production Input Package first.",
        running: false,
        recommendation: this.recommendation,
      };
    }
    if (prog.running) {
      return {
        explanation: [
          `Analyzing ${prog.completed} of ${prog.total} images.`,
          prog.currentFile ? `Current image: ${prog.currentFile}.` : "",
          prog.currentStage ? `Current task: ${STAGE_LABELS[prog.currentStage]}.` : "",
          `Overall ${prog.percent}%.`,
        ].filter(Boolean).join(" "),
        running: true,
        percent: prog.percent,
        recommendation: this.recommendation,
      };
    }
    const explanation = [
      `I have analyzed ${p!.aggregate.imagesAnalyzed} of ${p!.aggregate.imagesTotal} images for “${p!.productName}”.`,
      `Product detection average ${Math.round(p!.aggregate.productDetectionAvg * 100)}%.`,
      p!.aggregate.primaryColor ? `Primary observed color: ${p!.aggregate.primaryColor}.` : "No primary color observed.",
      p!.warnings.length ? `${p!.warnings.length} warning(s).` : "No warnings.",
      p!.aggregate.needsReviewCount ? `${p!.aggregate.needsReviewCount} image(s) need review.` : "",
      "Observations are AI visual cues — verified Product Profile facts were not overwritten.",
      this.recommendation,
    ].filter(Boolean).join(" ");
    return {
      projectId: p!.projectId,
      imagesAnalyzed: p!.aggregate.imagesAnalyzed,
      warnings: p!.warnings.length,
      needsReview: p!.aggregate.needsReviewCount,
      coveragePercent: p!.coveragePercent,
      status: p!.status,
      running: false,
      canContinue: p!.status === "complete" || p!.status === "partial",
      recommendation: this.recommendation,
      explanation,
    };
  }

  hydrateFromPackage(pkg?: ProductionInputPackage | null): boolean {
    const production = pkg ?? loadProductionPackage();
    if (!production || (production.status !== "confirmed" && production.status !== "handed-off" && production.status !== "draft")) {
      const stored = Object.values(loadStore())[0];
      if (stored) {
        this.pkg = stored;
        this.recommendation = "Restored local visual analysis package.";
        this.emitAction("ProductVisualAnalysisStarted", { restored: true, projectId: stored.projectId });
        this.emit();
        return true;
      }
      this.recommendation = "No Phase 2 Production Input Package found. Complete Live Validation first.";
      this.emit();
      return false;
    }

    if (production.productProfile.projectId !== production.projectId) {
      throw new Error("Cross-project data blocked: production package mismatch.");
    }

    this.productionPackage = production;
    const stored = loadStore()[production.projectId];
    if (stored && stored.images.length > 0 && stored.status !== "idle" && stored.status !== "failed") {
      if (stored.status === "running") {
        stored.status = stored.images.some((i) => i.failed) && stored.images.every((i) => i.failed)
          ? "failed"
          : stored.images.some((i) => i.failed) ? "partial" : "complete";
        stored.updatedAt = new Date().toISOString();
        savePackage(stored);
      }
      this.pkg = stored;
      this.resumeCursor = stored.images.filter((i) => !i.failed).length;
      this.recommendation = stored.status === "complete" || stored.status === "partial"
        ? "Previous analysis restored — re-run to refresh or save the Visual Product Analysis Package."
        : "Restored interrupted analysis.";
      this.emit();
      return true;
    }

    this.recommendation = `Ready to analyze ${production.productImageSet?.images.length ?? 0} product image(s).`;
    this.emitAction("ProductVisualAnalysisStarted", { projectId: production.projectId, phase: "hydrated" });
    this.emitBus("product-analysis.started", { projectId: production.projectId, step: "phase-3-step-1" });
    this.emit();
    return true;
  }

  async runAnalysis(options?: { force?: boolean }): Promise<VisualProductAnalysisPackage> {
    if (!this.productionPackage) {
      if (!this.hydrateFromPackage()) throw new Error("No Production Input Package");
    }
    const production = this.productionPackage!;
    const imageSet = production.productImageSet ?? loadOrgSet(production.projectId);
    if (!imageSet?.images.length) throw new Error("Product Image Set missing — complete Phase 2 Image Organization.");

    if (this.progress.running) throw new Error("Analysis already running");

    this.progress = {
      ...emptyProgress(),
      total: imageSet.images.length,
      running: true,
      statusLabel: "Starting visual analysis…",
      currentStage: "loaded",
      stagePercents: { loaded: 100 },
    };
    this.emitAction("ProductVisualAnalysisStarted", { projectId: production.projectId });
    this.emitBus("product-analysis.started", { projectId: production.projectId });
    this.emit();

    let serverProfiles: ServerImageProfile[] = [];
    let productIntel: ServerProductIntel | null = null;
    this.serviceAvailable = true;

    try {
      // Parallel fetch of independent intelligence services
      const [imagesResult, productResult] = await Promise.allSettled([
        fetchImageIntelligence(production.projectId),
        fetchProductIntelligence(production.projectId),
      ]);
      if (imagesResult.status === "fulfilled") {
        serverProfiles = imagesResult.value;
      } else {
        this.serviceAvailable = false;
        this.notify?.(
          "warning",
          "Analysis service unavailable",
          "Using Product Image Set + local evidence heuristics. Retry when the service is online.",
          "warnings",
        );
      }
      if (productResult.status === "fulfilled") productIntel = productResult.value;
    } catch (error) {
      this.serviceAvailable = false;
      this.notify?.(
        "warning",
        "ANALYSIS SERVICE UNAVAILABLE",
        error instanceof Error ? error.message : "Falling back to local analysis",
        "warnings",
      );
    }

    const stages: AnalysisStage[] = ANALYSIS_STAGES.filter((s) => s !== "loaded" && s !== "saved");
    const startIndex = options?.force ? 0 : this.resumeCursor;
    const images = imageSet.images;

    const assembled = assembleVisualPackage({
      analysisId: this.pkg?.analysisId && !options?.force ? this.pkg.analysisId : uid("vana"),
      projectId: production.projectId,
      projectName: production.projectName,
      productId: production.productId,
      productionPackageRef: production.packageId,
      profile: production.productProfile,
      imageSet,
      serverProfiles,
      productIntel,
    });

    if (this.pkg && !options?.force) {
      const prev = new Map(this.pkg.images.map((i) => [i.assetId, i.reviewStatus]));
      assembled.images = assembled.images.map((img) => ({
        ...img,
        reviewStatus: prev.get(img.assetId) ?? img.reviewStatus,
      }));
    }

    assembled.status = "running";
    this.pkg = assembled;
    savePackage(assembled);
    this.markDirty();

    for (let i = startIndex; i < images.length; i++) {
      const img = images[i]!;
      this.progress.currentFile = img.fileName;
      this.emitAction("ProductImageAnalysisStarted", { assetId: img.assetId, fileName: img.fileName });

      for (let s = 0; s < stages.length; s++) {
        const stage = stages[s]!;
        this.progress.currentStage = stage;
        this.progress.statusLabel = `${STAGE_LABELS[stage]} · ${img.fileName}`;
        this.progress.percent = Math.round(((i + (s + 1) / stages.length) / images.length) * 95);
        this.progress.stagePercents = { ...this.progress.stagePercents, [stage]: Math.round(((s + 1) / stages.length) * 100) };
        this.emitAction("ProductImageAnalysisProgress", {
          assetId: img.assetId,
          stage,
          percent: this.progress.percent,
        });
        this.emitBus("production.progress", { percent: this.progress.percent, label: this.progress.statusLabel });
        this.emit();
        await delay(18);
      }

      this.progress.completed = i + 1;
      this.resumeCursor = i + 1;
      this.markDirty();
    }

    this.progress.currentStage = "saved";
    this.progress.statusLabel = "Saving analysis package…";
    this.progress.percent = 98;
    this.emit();

    assembled.status = assembled.images.some((i) => i.failed) && assembled.images.every((i) => i.failed) ? "failed"
      : assembled.images.some((i) => i.failed) ? "partial"
        : "complete";
    assembled.updatedAt = new Date().toISOString();

    this.pkg = assembled;
    savePackage(assembled);
    this.progress = {
      ...this.progress,
      running: false,
      percent: 100,
      completed: images.length,
      currentFile: null,
      currentStage: "saved",
      statusLabel: "Analysis complete",
      stagePercents: Object.fromEntries(ANALYSIS_STAGES.map((s) => [s, 100])),
    };
    this.recommendation = assembled.status === "complete"
      ? "Visual analysis complete — review results, then continue to Deep Product Intelligence."
      : assembled.status === "partial"
        ? "Partial analysis saved — retry failed images or continue with available results."
        : "Analysis failed — retry when the service is available.";

    this.emitStageCompletions(assembled);
    this.emitAction("ProductVisualAnalysisCompleted", {
      projectId: assembled.projectId,
      status: assembled.status,
      imagesAnalyzed: assembled.aggregate.imagesAnalyzed,
    });
    this.emitBus("product-analysis.completed", {
      projectId: assembled.projectId,
      phase: "visual-analysis",
      status: assembled.status,
    });
    this.markDirty();
    this.emit();
    return assembled;
  }

  setImageReview(assetId: string, status: ReviewStatus): void {
    if (!this.pkg) return;
    this.pkg = {
      ...this.pkg,
      images: this.pkg.images.map((img) => (img.assetId === assetId ? { ...img, reviewStatus: status } : img)),
      updatedAt: new Date().toISOString(),
    };
    savePackage(this.pkg);
    this.markDirty();
    this.emit();
  }

  async retryFailed(): Promise<VisualProductAnalysisPackage> {
    return this.runAnalysis({ force: true });
  }

  continueToStep2(): Step2DeepIntelHandoffPayload {
    if (!this.pkg || (this.pkg.status !== "complete" && this.pkg.status !== "partial")) {
      throw new Error("Complete visual analysis before continuing");
    }
    const handoff: Step2DeepIntelHandoffPayload = {
      version: 1,
      step: "step-2-deep-product-intelligence",
      projectId: this.pkg.projectId,
      projectName: this.pkg.projectName,
      visualAnalysis: this.pkg,
      productionPackage: this.productionPackage,
      preparedAt: new Date().toISOString(),
    };
    localStorage.setItem(VISUAL_HANDOFF_KEY, JSON.stringify(handoff));
    this.handoffReady = true;
    this.emitAction("ProductVisualAnalysisCompleted", { handoff: true, step: "step-2" });
    this.emit();
    return handoff;
  }

  private emitStageCompletions(pkg: VisualProductAnalysisPackage): void {
    this.emitAction("ProductDetectionCompleted", { avg: pkg.aggregate.productDetectionAvg });
    this.emitAction("BackgroundDetectionCompleted", {});
    this.emitAction("ColorDetectionCompleted", { primary: pkg.aggregate.primaryColor });
    this.emitAction("LogoDetectionCompleted", { detected: pkg.aggregate.logoDetected });
    this.emitAction("TextDetectionCompleted", { detected: pkg.aggregate.textDetected });
    this.emitAction("ProductViewAnalysisCompleted", { coverage: pkg.coveragePercent });
    this.emitAction("ImageQualityAnalysisCompleted", { good: pkg.aggregate.qualityGoodCount });
    this.emitAction("MissingPhotoDetectionCompleted", { coverage: pkg.coveragePercent });
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, module: "visual-analysis", ...payload });
    this.emitEvents?.("product.updated", { action, module: "visual-analysis", ...payload });
  }

  private emitBus(type: string, payload: Record<string, unknown>): void {
    this.emitEvents?.(type, payload);
  }

  private markDirty(): void {
    void import("../shell/workspace-state/workspace-state-engine").then(({ workspaceStateEngine }) => {
      workspaceStateEngine.autoSave.markDirty();
    });
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }
}

export const visualAnalysisEngine = new VisualAnalysisEngine();

export function loadStep2DeepIntelHandoff(): Step2DeepIntelHandoffPayload | null {
  try {
    const raw = JSON.parse(localStorage.getItem(VISUAL_HANDOFF_KEY) ?? "null") as Step2DeepIntelHandoffPayload | null;
    return raw?.version === 1 ? raw : null;
  } catch {
    return null;
  }
}

// silence unused import for ImageVisualResult type re-export consumers
export type { ImageVisualResult };
