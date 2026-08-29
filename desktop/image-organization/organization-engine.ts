import { loadHandoff as loadIntakeHandoff, loadProjectMeta, openProjectApi } from "../product-intake/api";
import type { IntakeAssetMeta, IntakeHandoffPayload } from "../product-intake/types";
import {
  pickStoreForProject,
  persistProductImageSet,
  persistWorkflowStep,
  prerequisiteBlockReason,
  readProductImageSetFromProject,
  readScopedHandoff,
  resolveBoundProject,
  writeScopedHandoff,
} from "../product-creation/workflow";
import {
  classifyBackground, classifyFileName, mapServerRoleToView, mapViewToServerRole,
  recommendedViewsForCategory,
} from "./classify";
import type {
  OrganizationSnapshot, OrganizationViewType, OrganizationWarning, OrganizedImage,
  ProductImageSet, Step3HandoffPayload, ViewGroup,
} from "./types";
import { ALL_VIEW_TYPES, LOW_CONFIDENCE, ORG_HANDOFF_KEY, ORG_STORE_KEY } from "./types";

interface ServerProfile {
  imageId: string;
  fileName: string;
  viewRole: string;
  quality: { score: number };
  background: { type: string };
  defects: string[];
  duplicateOfImageId?: string;
  resolution?: { tier: string };
  metadata?: Record<string, string | number>;
  analysisState?: string;
  aiVisionStatus?: string;
  processingState?: string;
  analysisVersion?: string;
  derivedThumbnailId?: string;
  provenance?: {
    provider?: string;
    analysisVersion?: string;
    timestamp?: string;
    originalChecksumSha256?: string;
  };
  visualMetrics?: {
    method?: string;
    pixelAnalysisAvailable?: boolean;
    width?: number;
    height?: number;
    aspectRatio?: number;
    dominantColors?: Array<{ name: string; hex: string }>;
    lightingObserved?: string;
    backgroundObserved?: string;
  };
  observations?: Array<{ field: string; value: string; kind: string; confidence: number }>;
}

interface ProductIntelProfile {
  category?: string;
  productType?: string;
  identifiedAs?: string;
  multiView?: { missingAngles?: string[] };
  imageAnalysis?: { missingAngles?: string[]; duplicateImageIds?: string[] };
}

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;

type Listener = (snap: OrganizationSnapshot) => void;

async function analyzeImageIntelligence(projectId: string): Promise<ServerProfile[]> {
  const response = await fetch(`/api/image-intelligence/projects/${projectId}/analyze`, { method: "POST" });
  const body = await response.json() as { profiles?: ServerProfile[]; error?: string };
  if (!response.ok) throw new Error(body.error ?? "Image analysis failed");
  return body.profiles ?? [];
}

async function analyzeProductIntelligence(projectId: string): Promise<ProductIntelProfile | null> {
  const response = await fetch(`/api/product-intelligence/projects/${projectId}/analyze`, { method: "POST" });
  const body = await response.json() as { profile?: ProductIntelProfile; error?: string };
  if (!response.ok) return null;
  return body.profile ?? null;
}

async function overrideViewRoleApi(projectId: string, imageId: string, viewRole: string): Promise<void> {
  await fetch(`/api/image-intelligence/projects/${projectId}/images/${imageId}/view-role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ viewRole, confidence: 1 }),
  });
}

function loadStoredSets(): Record<string, ProductImageSet> {
  try {
    return JSON.parse(localStorage.getItem(ORG_STORE_KEY) ?? "{}") as Record<string, ProductImageSet>;
  } catch {
    return {};
  }
}

function saveStoredSet(set: ProductImageSet): void {
  const map = loadStoredSets();
  map[set.projectId] = set;
  localStorage.setItem(ORG_STORE_KEY, JSON.stringify(map));
}

export function loadStep3Handoff(projectId?: string | null): Step3HandoffPayload | null {
  const payload = readScopedHandoff<Step3HandoffPayload>(ORG_HANDOFF_KEY, projectId);
  return payload?.version === 1 && payload.step === "step-3-product-information" ? payload : null;
}

function visibilityFromDefects(defects: string[], resolutionTier?: string): OrganizedImage["visibilityStatus"] {
  const text = defects.join(" ").toLowerCase();
  if (/cut.?off|cropped|clipped/.test(text)) return "cut-off";
  if (/small|tiny|distant/.test(text) || resolutionTier === "low") return "small";
  if (/obstruct|hidden|partial/.test(text)) return "partial";
  if (/blur|soft/.test(text)) return "partial";
  return defects.length ? "partial" : "clear";
}

export class ImageOrganizationEngine {
  private projectId: string | null = null;
  private projectName = "";
  private intakeAssets: IntakeAssetMeta[] = [];
  private productImageSet: ProductImageSet | null = null;
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private running = false;
  private progress = {
    total: 0,
    completed: 0,
    percent: 0,
    currentFile: null as string | null,
    currentClassification: null as OrganizationViewType | null,
    currentConfidence: null as number | null,
    statusLabel: "Idle",
    running: false,
  };
  private handoffReady = false;
  private _transitioning = false;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;

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

  snapshot(): OrganizationSnapshot {
    const set = this.productImageSet;
    const critical = set?.images.some((i) => i.analysisFailed && !i.userCorrected) ?? false;
    const canContinue = Boolean(
      set
      && set.images.length > 0
      && !this.running
      && !critical
      && set.images.every((i) => Boolean(i.viewType)),
    );
    let continueBlockedReason: string | null = null;
    if (!set) continueBlockedReason = "Run product image analysis first.";
    else if (this.running) continueBlockedReason = "Wait for analysis to finish.";
    else if (critical) continueBlockedReason = "Retry or manually classify failed images.";
    else if (!set.images.length) continueBlockedReason = "No analyzed images available.";

    return {
      version: 1,
      projectId: this.projectId,
      projectName: this.projectName,
      progress: { ...this.progress },
      productImageSet: set,
      canContinue,
      continueBlockedReason,
      handoffReady: this.handoffReady,
      recommendation: !set
        ? "Load Step 1 assets and start analysis."
        : canContinue
          ? `Coverage ${set.coverageScore}%. Continue to Step 3 when ready.`
          : continueBlockedReason ?? "Review classifications.",
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    const snap = this.snapshot();
    const set = snap.productImageSet;
    const explanation = [
      set
        ? `${set.images.length} image(s) organized for “${snap.projectName}”. Coverage ${set.coverageScore}%.`
        : "Product image organization has not produced a set yet.",
      set?.missingViews.length
        ? `Missing useful views: ${set.missingViews.join(", ")}.`
        : "No missing recommended views detected for this category.",
      set?.warnings.length ? `${set.warnings.length} warning(s) — originals were not modified.` : "No organization warnings.",
      snap.progress.running
        ? `Analyzing ${snap.progress.completed}/${snap.progress.total}: ${snap.progress.currentFile ?? "—"}.`
        : "Analysis idle.",
      snap.recommendation,
    ].join(" ");
    return {
      projectId: snap.projectId,
      projectName: snap.projectName,
      imageCount: set?.images.length ?? 0,
      coverageScore: set?.coverageScore ?? 0,
      missingViews: set?.missingViews ?? [],
      warningCount: set?.warnings.length ?? 0,
      canContinue: snap.canContinue,
      recommendation: snap.recommendation,
      explanation,
    };
  }

  /** Load Step 1 handoff or restore organization for the active project only. */
  async hydrateFromHandoff(handoff?: IntakeHandoffPayload | null): Promise<boolean> {
    const bound = await resolveBoundProject({
      handoffProjectId: handoff?.projectId ?? loadIntakeHandoff()?.projectId ?? null,
    });
    if (!bound) {
      this.notify?.("warning", "No active project", "Complete Product Intake (Step 1) first.", "warnings");
      this.emit();
      return false;
    }

    const block = prerequisiteBlockReason(2, bound.project);
    if (block) {
      this.notify?.("warning", "Step 2 blocked", block, "warnings");
      this.emit();
      return false;
    }

    try {
      await openProjectApi(bound.projectId);
    } catch (error) {
      this.notify?.("error", "Project unavailable", error instanceof Error ? error.message : "Open failed", "errors");
      return false;
    }

    const payload = handoff
      ?? loadIntakeHandoff(bound.projectId)
      ?? (loadIntakeHandoff()?.projectId === bound.projectId ? loadIntakeHandoff() : null);

    this.projectId = bound.projectId;
    this.projectName = bound.projectName;

    if (payload?.step === "step-2-image-organization" && payload.projectId === bound.projectId) {
      this.intakeAssets = payload.assets.filter((a) => a.processingStatus === "saved" && a.validationStatus !== "invalid");
    } else {
      this.intakeAssets = loadProjectMeta(bound.projectId).filter(
        (a) => a.processingStatus === "saved" && a.validationStatus !== "invalid",
      );
      if (!this.intakeAssets.length && bound.project.productImages?.length) {
        this.intakeAssets = bound.project.productImages
          .filter((img) => !img.parentAssetId && img.origin !== "derived" && img.assetType !== "derived-image")
          .map((img) => ({
          assetId: img.id,
          projectId: bound.projectId,
          originalFilename: img.sourceFileName || img.fileName,
          fileType: img.mimeType,
          width: img.width ?? null,
          height: img.height ?? null,
          fileSize: img.sizeBytes,
          importDate: img.uploadedAt,
          sourceReference: img.url,
          validationStatus: "valid" as const,
          duplicateStatus: "none" as const,
          processingStatus: "saved" as const,
          checksum: img.checksumSha256 ?? "",
          remoteUrl: img.url,
          thumbnailUrl: img.url,
          warnings: [],
        }));
      }
    }

    const existing = pickStoreForProject(loadStoredSets(), bound.projectId);
    const fromServer = readProductImageSetFromProject(bound.project) as ProductImageSet | null;
    if (existing) this.productImageSet = existing;
    else if (fromServer && typeof fromServer === "object" && (fromServer as ProductImageSet).projectId === bound.projectId) {
      this.productImageSet = fromServer as ProductImageSet;
      saveStoredSet(fromServer as ProductImageSet);
    }

    this.emit();
    return true;
  }

  async runAnalysis(): Promise<ProductImageSet> {
    if (!this.projectId) {
      if (!(await this.hydrateFromHandoff())) throw new Error("No Step 1 handoff found. Complete Product Intake first.");
    }
    if (!this.projectId) throw new Error("Project missing");
    if (this.running) throw new Error("Analysis already running");

    this.running = true;
    const assets = this.intakeAssets.length
      ? this.intakeAssets
      : (loadIntakeHandoff(this.projectId)?.assets ?? []).filter((a) => a.processingStatus === "saved");
    this.intakeAssets = assets;
    this.progress = {
      total: Math.max(assets.length, 1),
      completed: 0,
      percent: 5,
      currentFile: null,
      currentClassification: null,
      currentConfidence: null,
      statusLabel: "Requesting image intelligence…",
      running: true,
    };
    this.emitEvents?.("product-analysis.started", { projectId: this.projectId });
    this.emit();

    try {
      let profiles: ServerProfile[] = [];
      try {
        profiles = await analyzeImageIntelligence(this.projectId);
      } catch (error) {
        this.notify?.("warning", "Server analysis limited", error instanceof Error ? error.message : "Using local classification", "warnings");
      }

      let product: ProductIntelProfile | null = null;
      try {
        product = await analyzeProductIntelligence(this.projectId);
      } catch {
        product = null;
      }

      this.progress.statusLabel = profiles.length
        ? "Server analysis complete. Organizing results…"
        : "Server analysis unavailable. Using local filename classification…";
      this.progress.percent = 40;
      this.emit();

      const organized: OrganizedImage[] = [];
      const warnings: OrganizationWarning[] = [];
      const category = product?.category || product?.productType || product?.identifiedAs || "general product";

      for (let i = 0; i < assets.length; i += 1) {
        const asset = assets[i]!;
        this.progress.currentFile = asset.originalFilename;
        this.progress.completed = i;
        this.progress.percent = Math.round((i / Math.max(assets.length, 1)) * 100);
        this.progress.statusLabel = "Organizing analyzed assets…";
        this.emit();

        const profile = profiles.find((p) => p.imageId === asset.assetId);
        const local = classifyFileName(asset.originalFilename);
        let viewType = local.viewType;
        let confidence = local.confidence;
        if (profile) {
          viewType = mapServerRoleToView(profile.viewRole);
          if (profile.metadata?.viewConfidence != null) {
            confidence = Number(profile.metadata.viewConfidence) / 100;
          } else {
            confidence = local.serverRole === profile.viewRole
              ? local.confidence
              : Math.max(0.5, local.confidence - 0.15);
          }
        }

        this.progress.currentClassification = viewType;
        this.progress.currentConfidence = confidence;
        this.emitEvents?.("production.progress", {
          projectId: this.projectId,
          file: asset.originalFilename,
          viewType,
          confidence,
          index: i,
          total: assets.length,
          percent: Math.round(((i + 1) / Math.max(assets.length, 1)) * 100),
        });

        const itemWarnings: OrganizationWarning[] = [];
        const needsReview = confidence < LOW_CONFIDENCE || viewType === "UNKNOWN";
        if (needsReview) {
          itemWarnings.push({ code: "low-confidence", message: `${asset.originalFilename} needs review (${Math.round(confidence * 100)}% confidence).`, assetId: asset.assetId });
        }

        const visibility = visibilityFromDefects(profile?.defects ?? [], profile?.resolution?.tier);
        if (visibility !== "clear") {
          itemWarnings.push({
            code: "visibility",
            message: `${asset.originalFilename}: product visibility issue (${visibility}). Consider another shot.`,
            assetId: asset.assetId,
          });
        }

        if (profile?.duplicateOfImageId) {
          itemWarnings.push({
            code: "duplicate",
            message: `${asset.originalFilename} looks like a duplicate of another upload.`,
            assetId: asset.assetId,
          });
        }

        // Near-duplicate by matching view + similar size from intake checksum
        const near = assets.find((other) =>
          other.assetId !== asset.assetId
          && other.checksum
          && other.checksum === asset.checksum,
        );
        if (near && !profile?.duplicateOfImageId) {
          itemWarnings.push({
            code: "near-duplicate",
            message: `Near-duplicate of ${near.originalFilename} (same fingerprint).`,
            assetId: asset.assetId,
          });
        }

        const image: OrganizedImage = {
          assetId: asset.assetId,
          projectId: this.projectId!,
          fileName: asset.originalFilename,
          mimeType: asset.fileType,
          width: profile?.visualMetrics?.width ?? asset.width,
          height: profile?.visualMetrics?.height ?? asset.height,
          fileSize: asset.fileSize,
          url: asset.remoteUrl || asset.thumbnailUrl,
          viewType,
          confidence,
          roleInGroup: "alternative",
          groupId: `view-${viewType}`,
          backgroundType: classifyBackground(profile?.background?.type ?? "unknown"),
          visibilityStatus: visibility,
          duplicateOfAssetId: profile?.duplicateOfImageId ?? near?.assetId,
          similarity: profile?.duplicateOfImageId || near ? 0.94 : undefined,
          needsReview,
          analysisFailed: false,
          userCorrected: false,
          qualityScore: profile?.quality?.score ?? 70,
          warnings: itemWarnings,
          analyzedAt: new Date().toISOString(),
          origin: "original",
          processingState: "ready",
          analysisState: profile?.analysisState ?? (profile ? "ready" : "unavailable"),
          aiVisionStatus: profile?.aiVisionStatus ?? "IMAGE_ANALYSIS_UNAVAILABLE",
          analysisVersion: profile?.analysisVersion,
          provenanceProvider: profile?.provenance?.provider,
          visualMethod: profile?.visualMetrics?.method,
          pixelAnalysisAvailable: Boolean(profile?.visualMetrics?.pixelAnalysisAvailable),
          observations: profile?.observations,
          derivedThumbnailId: profile?.derivedThumbnailId,
        };
        organized.push(image);
        warnings.push(...itemWarnings);
      }

      // Assign primary per group (highest confidence, prefer non-duplicates)
      const byView = new Map<OrganizationViewType, OrganizedImage[]>();
      for (const img of organized) {
        const list = byView.get(img.viewType) ?? [];
        list.push(img);
        byView.set(img.viewType, list);
      }
      for (const [, list] of byView) {
        list.sort((a, b) => b.confidence - a.confidence || b.qualityScore - a.qualityScore);
        const primary = list.find((i) => !i.duplicateOfAssetId) ?? list[0];
        for (const img of list) {
          if (img.assetId === primary?.assetId) {
            img.roleInGroup = img.viewType === "DETAIL" || img.viewType === "LOGO" ? "detail" : "primary";
          } else if (img.viewType === "DETAIL") {
            img.roleInGroup = "detail";
          } else {
            img.roleInGroup = "alternative";
          }
        }
      }

      const recommended = recommendedViewsForCategory(category);
      const present = new Set(organized.filter((i) => !i.duplicateOfAssetId).map((i) => i.viewType));
      if (present.has("LEFT") || present.has("RIGHT")) present.add("OTHER");
      const missingViews = recommended.filter((v) => !present.has(v));
      for (const missing of missingViews) {
        warnings.push({ code: "missing-view", message: `Missing view: ${missing}. Not detected in the imported set.` });
      }

      const coverageScore = recommended.length
        ? Math.round(((recommended.length - missingViews.length) / recommended.length) * 100)
        : 100;

      // Consistency heuristic: many UNKNOWN or conflicting categories
      const named = organized.filter((i) => i.viewType !== "UNKNOWN").length;
      const consistencyOk = named >= Math.ceil(organized.length * 0.4) || organized.length <= 2;
      if (!consistencyOk) {
        warnings.push({
          code: "consistency",
          message: "Several images could not be classified confidently — they may show different products. Please review.",
        });
      }

      const groups = this.buildGroups(organized, missingViews);
      const set: ProductImageSet = {
        version: 1,
        projectId: this.projectId!,
        projectName: this.projectName,
        categoryEstimate: category,
        groups,
        images: organized,
        missingViews,
        recommendedViews: recommended,
        coverageScore,
        warnings: dedupeWarnings(warnings),
        consistencyOk,
        analyzedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.productImageSet = set;
      saveStoredSet(set);
      this.progress = {
        total: assets.length,
        completed: assets.length,
        percent: 100,
        currentFile: null,
        currentClassification: null,
        currentConfidence: null,
        statusLabel: profiles.length ? "Analysis complete" : "Organization complete (filename classification)",
        running: false,
      };
      this.emitEvents?.("product-analysis.completed", {
        projectId: this.projectId,
        coverageScore,
        imageCount: organized.length,
        missingViews,
      });
      this.notify?.("success", "Organization complete", `${organized.length} images analyzed. Coverage ${coverageScore}%.`, "production-complete");
      this.emit();
      return set;
    } catch (error) {
      this.progress.running = false;
      this.progress.statusLabel = "Analysis failed";
      this.notify?.("error", "Analysis failed", error instanceof Error ? error.message : "Unknown error", "errors");
      this.emit();
      throw error;
    } finally {
      this.running = false;
      this.progress.running = false;
      this.emit();
    }
  }

  async setPrimary(assetId: string): Promise<void> {
    const set = this.productImageSet;
    if (!set) return;
    const target = set.images.find((i) => i.assetId === assetId);
    if (!target) return;
    set.images = set.images.map((img) => {
      if (img.viewType !== target.viewType) return img;
      if (img.assetId === assetId) return { ...img, roleInGroup: "primary" as const };
      if (img.roleInGroup === "primary") return { ...img, roleInGroup: "alternative" as const };
      return img;
    });
    set.groups = this.buildGroups(set.images, set.missingViews);
    set.updatedAt = new Date().toISOString();
    saveStoredSet(set);
    this.markDirty();
    this.emitEvents?.("state.shared", { action: "primary-changed", assetId });
    this.emit();
  }

  async reclassify(assetId: string, viewType: OrganizationViewType): Promise<void> {
    const set = this.productImageSet;
    if (!set || !this.projectId) return;
    set.images = set.images.map((img) =>
      img.assetId === assetId
        ? {
          ...img,
          viewType,
          confidence: 1,
          needsReview: false,
          userCorrected: true,
          analysisFailed: false,
          groupId: `view-${viewType}`,
          roleInGroup: "alternative",
        }
        : img,
    );
    // Recompute primaries for affected groups
    const views = new Set(set.images.map((i) => i.viewType));
    for (const view of views) {
      const list = set.images.filter((i) => i.viewType === view);
      if (!list.some((i) => i.roleInGroup === "primary")) {
        const best = list[0];
        if (best) best.roleInGroup = "primary";
      }
    }
    const present = new Set(set.images.filter((i) => !i.duplicateOfAssetId).map((i) => i.viewType));
    set.missingViews = set.recommendedViews.filter((v) => !present.has(v));
    set.coverageScore = set.recommendedViews.length
      ? Math.round(((set.recommendedViews.length - set.missingViews.length) / set.recommendedViews.length) * 100)
      : 100;
    set.groups = this.buildGroups(set.images, set.missingViews);
    set.updatedAt = new Date().toISOString();
    saveStoredSet(set);
    try {
      await overrideViewRoleApi(this.projectId, assetId, mapViewToServerRole(viewType));
    } catch {
      /* local correction still saved */
    }
    this.markDirty();
    this.notify?.("info", "Classification updated", `${assetId.slice(0, 8)}… → ${viewType}`, "updates");
    this.emit();
  }

  removeFromGroup(assetId: string): void {
    const set = this.productImageSet;
    if (!set) return;
    set.images = set.images.map((img) =>
      img.assetId === assetId
        ? { ...img, viewType: "UNKNOWN" as const, roleInGroup: "alternative" as const, groupId: "view-UNKNOWN", userCorrected: true }
        : img,
    );
    set.groups = this.buildGroups(set.images, set.missingViews);
    set.updatedAt = new Date().toISOString();
    saveStoredSet(set);
    this.markDirty();
    this.emit();
  }

  keepDuplicate(assetId: string): void {
    const set = this.productImageSet;
    if (!set) return;
    set.images = set.images.map((img) =>
      img.assetId === assetId
        ? { ...img, duplicateOfAssetId: undefined, warnings: img.warnings.filter((w) => w.code !== "duplicate" && w.code !== "near-duplicate") }
        : img,
    );
    set.warnings = set.warnings.filter((w) => w.assetId !== assetId || (w.code !== "duplicate" && w.code !== "near-duplicate"));
    set.updatedAt = new Date().toISOString();
    saveStoredSet(set);
    this.markDirty();
    this.emit();
  }

  async continueToStep3(): Promise<Step3HandoffPayload> {
    const snap = this.snapshot();
    if (!snap.canContinue || !snap.productImageSet || !snap.projectId) {
      throw new Error(snap.continueBlockedReason ?? "Organization incomplete");
    }
    if (this._transitioning) throw new Error("Step transition already in progress.");
    this._transitioning = true;
    try {
      saveStoredSet(snap.productImageSet);
      await persistProductImageSet(snap.projectId, snap.productImageSet);
      const handoff: Step3HandoffPayload = {
        version: 1,
        step: "step-3-product-information",
        projectId: snap.projectId,
        projectName: snap.projectName,
        productImageSet: snap.productImageSet,
        preparedAt: new Date().toISOString(),
      };
      writeScopedHandoff(ORG_HANDOFF_KEY, handoff);
      await persistWorkflowStep(snap.projectId, 3, 2);
      this.handoffReady = true;
      this.markDirty();
      console.info("[STEP_2_COMPLETED]", { projectId: snap.projectId, coverage: snap.productImageSet.coverageScore });
      this.emitEvents?.("product.updated", {
        action: "organization.ready-for-step-3",
        projectId: handoff.projectId,
        coverageScore: handoff.productImageSet.coverageScore,
      });
      this.emit();
      return handoff;
    } finally {
      this._transitioning = false;
    }
  }

  private buildGroups(images: OrganizedImage[], missingViews: OrganizationViewType[]): ViewGroup[] {
    const order = ALL_VIEW_TYPES.filter((v) => v !== "UNKNOWN" && v !== "OTHER").concat(["OTHER", "UNKNOWN"]);
    return order.map((viewType) => {
      const list = images.filter((i) => i.viewType === viewType);
      const primary = list.find((i) => i.roleInGroup === "primary") ?? list[0] ?? null;
      return {
        viewType,
        groupId: `view-${viewType}`,
        primaryAssetId: primary?.assetId ?? null,
        images: list,
        missing: list.length === 0 && missingViews.includes(viewType),
      };
    }).filter((g) => g.images.length > 0 || g.missing);
  }

  private markDirty(): void {
    void import("../shell/workspace-state/workspace-state-engine").then(({ workspaceStateEngine }) => {
      workspaceStateEngine.autoSave.markDirty();
    }).catch(() => undefined);
  }

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }
}

function dedupeWarnings(list: OrganizationWarning[]): OrganizationWarning[] {
  const seen = new Set<string>();
  return list.filter((w) => {
    const key = `${w.code}:${w.assetId ?? ""}:${w.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const imageOrganizationEngine = new ImageOrganizationEngine();
