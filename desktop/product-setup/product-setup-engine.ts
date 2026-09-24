/**
 * Unified STEP 1 engine — orchestrates intake, image organization, and product essentials.
 * Reuses existing engines; does not duplicate persistence or analysis.
 */

import { productIntakeEngine } from "../product-intake/intake-engine";
import { openProjectApi, updateProjectApi } from "../product-intake/api";
import { imageOrganizationEngine } from "../image-organization/organization-engine";
import type { OrganizationViewType } from "../image-organization/types";
import {
  persistProductImageSet,
  persistWorkflowStep,
  writeScopedHandoff,
} from "../product-creation/workflow";
import { fetchMediaIntelligence, formatMediaStatusLabel } from "../media-intelligence/api";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { calculateDiscount } from "./discount";
import {
  buildAiSummary,
  buildImageCards,
  computeReadiness,
  deriveAnalysisStatus,
  suggestProductName,
} from "./readiness";
import type {
  OptionalProductDetails,
  PmvAspectRatio,
  PmvBrandContact,
  PmvFoundationSettings,
  PmvFoundationStatus,
  PmvVideoSettings,
  ProductEssentials,
  ProductSetupSnapshot,
  SaveState,
  Step2HandoffPayload,
} from "./types";
import { PMV_SETTINGS_KEY } from "./types";
import {
  analyzeProductIntelligence,
  buildProductIdentityLock,
  buildProductIntelligenceReview,
  computeAssetFingerprint,
  confirmIdentityLock,
  fetchProductIntelligenceProfile,
  markIdentityLockStale,
  PMV_IDENTITY_LOCK_KEY,
  validateIdentityLock,
  type PmvIntelligenceStatus,
  type ProductIdentityLock,
  type ProductIntelligenceReview,
} from "../product-identity-lock";
import {
  DEFAULT_PMV_CREATIVE_DIRECTION,
  audioRequirementsFromDirection,
  customerSafeError,
  mapPmvModeToProduction,
  mapProductionToPmvMode,
  pmvModeLabel,
  scenesFromPlan,
  toneFromEnergy,
  type PmvAudioRequirements,
  type PmvCreativeDirection,
  type PmvCreativeStatus,
  type PmvGenerationMode,
  type PmvModeCapabilityView,
  type PmvStoryboardSceneView,
} from "../pmv-creative";
import {
  mapIntelligence,
  mapLibraryItem,
  produceStageLabel,
  type PmvAudioIntelligenceView,
  type PmvAudioLibraryItem,
  type PmvBeatSyncMode,
  type PmvMusicCapabilityView,
  type PmvProduceStatus,
} from "../pmv-final";
import {
  PMV_SCENE_REGEN_MAX_ATTEMPTS,
  buildTargetedRegeneration,
  runDeterministicPmvQa,
  type PmvDeliveryStatus,
  type PmvTargetedRegeneration,
  type PmvVideoQaResult,
} from "../pmv-qa";
import {
  fetchProductionCapabilities,
  finalizeCreativePlan,
  generatePlanWithMode,
  getCreativePlan,
  updateCreativePlan,
} from "../video-style/api";
import {
  CAMERA_OPTIONS,
  MOTION_OPTIONS,
  createVideoProject,
  getVideoJob,
  getVideoOutputDetails,
  getVideoProject,
  startVideoRender,
  updateVideoProject,
  validateVideoRender,
  VideoProductionApiError,
} from "../video-production/api";
import type { ProductionModeId } from "../../ai/video-production/production-mode-types";
import type { CreativePlanDto } from "../deep-intelligence/live-api";

export const SETUP_HANDOFF_KEY = "kwizera.product-setup.handoff.v1";

type Listener = (snap: ProductSetupSnapshot) => void;
type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;

const emptyEssentials = (): ProductEssentials => ({
  productName: "",
  currentPrice: null,
  previousPrice: null,
  currency: "RWF",
  size: "",
  shortDescription: "",
});

const emptyOptional = (): OptionalProductDetails => ({
  brand: "",
  color: "",
  material: "",
  features: "",
  website: "",
  notes: "",
  longDescription: "",
  benefits: "",
  offer: "",
  productCategory: "",
  productCta: "",
});

const emptyBrandContact = (): PmvBrandContact => ({
  brandName: "",
  websiteName: "",
  websiteUrl: "",
  phone: "",
  whatsapp: "",
  email: "",
  cta: "",
  language: "en",
  logoAssetId: null,
  logoUrl: null,
  logoFileName: null,
});

const emptyVideoSettings = (): PmvVideoSettings => ({
  durationSeconds: 15,
  aspectRatio: "9:16",
  language: "en",
  cta: "",
});

function aspectToPlatform(aspect: PmvAspectRatio): string {
  if (aspect === "1:1") return "instagram-feed";
  if (aspect === "16:9") return "youtube";
  return "tiktok";
}

function platformToAspect(platform: string | undefined): PmvAspectRatio {
  const p = (platform ?? "").toLowerCase();
  if (p.includes("feed") || p.includes("1:1") || p.includes("square")) return "1:1";
  if (p.includes("youtube") || p.includes("16:9") || p.includes("landscape")) return "16:9";
  return "9:16";
}

export class ProductSetupEngine {
  private essentials = emptyEssentials();
  private optional = emptyOptional();
  private brandContact = emptyBrandContact();
  private videoSettings = emptyVideoSettings();
  private foundationStatus: PmvFoundationStatus = "DRAFT";
  private heroAssetId: string | null = null;
  private assetOrder: string[] = [];
  private serviceMode: "standard" | "pmv" = "standard";
  private intelligenceStatus: PmvIntelligenceStatus = "NOT_STARTED";
  private intelligenceReview: ProductIntelligenceReview | null = null;
  private identityLock: ProductIdentityLock | null = null;
  private intelligenceError: string | null = null;
  private intelligenceAssetFingerprint: string | null = null;
  private creativeStatus: PmvCreativeStatus = "NOT_STARTED";
  private creativeDirection: PmvCreativeDirection = DEFAULT_PMV_CREATIVE_DIRECTION();
  private creativeScenes: PmvStoryboardSceneView[] = [];
  private creativeCapabilities: PmvModeCapabilityView[] = [];
  private creativePlan: CreativePlanDto | null = null;
  private creativePlanId: string | null = null;
  private creativePlanStatus: string | null = null;
  private productionMode: ProductionModeId | null = null;
  private renderJobId: string | null = null;
  private videoReady = false;
  private creativeError: string | null = null;
  private audioRequirements: PmvAudioRequirements | null = null;
  private produceStatus: PmvProduceStatus = "NOT_STARTED";
  private audioLibrary: PmvAudioLibraryItem[] = [];
  private selectedAudioAssetId: string | null = null;
  private selectedAudioTitle: string | null = null;
  private audioEnabled = false;
  private audioVolume = 1;
  private beatSyncMode: PmvBeatSyncMode = "SMART";
  private audioIntelligence: PmvAudioIntelligenceView | null = null;
  private musicCapability: PmvMusicCapabilityView = {
    available: false,
    status: "UNAVAILABLE",
    reason: "Not checked yet",
  };
  private timelineReady = false;
  private finalRenderJobId: string | null = null;
  private finalVideoReady = false;
  private finalOutputUrl: string | null = null;
  private finalOutputAssetId: string | null = null;
  private finalDurationMs: number | null = null;
  private finalWidth: number | null = null;
  private finalHeight: number | null = null;
  private produceProgress = 0;
  private produceError: string | null = null;
  private qaResult: PmvVideoQaResult | null = null;
  private deliveryStatus: PmvDeliveryStatus = "NOT_DELIVERED";
  private deliveredAt: string | null = null;
  private approvedRenderJobId: string | null = null;
  private approvedOutputAssetId: string | null = null;
  private targetedRegeneration: PmvTargetedRegeneration | null = null;
  private sceneRegenAttempts: Record<string, number> = {};
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private saveState: SaveState = "saved";
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private analysisFailed = false;
  private autoAnalysisQueued = false;
  private lastUploadRunning = false;
  private transitioning = false;
  private mediaPreparation: import("./types").MediaPreparationUiSummary | null = null;
  private unsubIntake: (() => void) | null = null;
  private unsubOrg: (() => void) | null = null;

  setServiceMode(mode: "standard" | "pmv"): void {
    this.serviceMode = mode;
  }

  setNotify(fn: NotifyFn | null): void {
    this.notify = fn;
    productIntakeEngine.setNotify(fn);
    imageOrganizationEngine.setNotify(fn);
  }

  subscribe(listener: Listener): () => void {
    this.wireSubscriptions();
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  async hydrateFromServer(): Promise<void> {
    await productIntakeEngine.hydrateFromServer();
    const intake = productIntakeEngine.snapshot();
    if (intake.projectId) {
      await imageOrganizationEngine.hydrateFromHandoff();
      try {
        const project = await openProjectApi(intake.projectId);
        this.essentials = this.essentialsFromProject(project);
        this.optional = this.optionalFromProject(project);
        this.brandContact = this.brandFromProject(project);
        this.videoSettings = this.videoSettingsFromProject(project);
        this.applyPmvSettings(project.workspaceSettings);
        this.applyIdentityLock(project.workspaceSettings);
        this.applyProjectAudio(project);
        this.refreshStaleLockState();
        if (
          this.creativeStatus === "PLAN_READY"
          || this.creativeStatus === "VIDEO_READY"
          || this.creativeStatus === "FAILED"
        ) {
          void this.hydrateCreativePlan(intake.projectId);
        }
        if (this.videoReady || this.finalVideoReady || this.produceStatus !== "NOT_STARTED") {
          void this.refreshFinalOutput();
          void this.refreshAudioLibrary();
          void this.refreshMusicCapability();
        }
        if (!this.heroAssetId) {
          const summary = buildAiSummary(imageOrganizationEngine.snapshot(), this.essentials);
          this.heroAssetId = summary?.heroAssetId ?? null;
        }
        if (this.assetOrder.length === 0 && project.productImages?.length) {
          this.assetOrder = project.productImages
            .filter((img) => img.assetRole !== "brand-logo")
            .map((img) => img.id);
        }
        if (
          this.intelligenceStatus === "REVIEW"
          || this.intelligenceStatus === "LOCKED"
          || this.intelligenceStatus === "STALE"
        ) {
          void this.hydrateIntelligenceProfile(intake.projectId);
        }
      } catch {
        /* keep local defaults */
      }
      await this.refreshMediaSummary(intake.projectId);
    }
    this.wireSubscriptions();
    this.emit();
  }

  private wireSubscriptions(): void {
    if (!this.unsubIntake) {
      this.unsubIntake = productIntakeEngine.subscribe((intake) => {
        const wasRunning = this.lastUploadRunning;
        this.lastUploadRunning = intake.progress.running;
        if (wasRunning && !intake.progress.running && intake.projectId) {
          void this.scheduleAutoAnalysis();
        }
        this.emit();
      });
    }
    if (!this.unsubOrg) {
      this.unsubOrg = imageOrganizationEngine.subscribe(() => this.emit());
    }
  }

  snapshot(): ProductSetupSnapshot {
    const intake = productIntakeEngine.snapshot();
    const org = imageOrganizationEngine.snapshot();
    const analysisStatus = deriveAnalysisStatus(intake, org, this.analysisFailed);
    const discount = calculateDiscount(this.essentials.previousPrice, this.essentials.currentPrice);
    const imageCards = this.orderImageCards(buildImageCards(intake, org));
    const aiSummary = buildAiSummary(org, this.essentials);
    const heroAssetId = this.heroAssetId
      || aiSummary?.heroAssetId
      || imageCards.find((c) => c.uploadStatus === "saved")?.assetId
      || null;
    const readiness = computeReadiness(intake, org, this.essentials, analysisStatus);
    const readyGate = this.computeReadyGate(intake.projectId, heroAssetId, imageCards, readiness);
    const productAssetIds = imageCards
      .filter((c) => c.uploadStatus === "saved")
      .map((c) => c.assetId);
    const lockValidation = validateIdentityLock({
      lock: this.identityLock,
      projectId: intake.projectId ?? "",
      productAssetIds,
      heroAssetId,
    });
    const canConfirmIdentityLock = this.intelligenceStatus === "REVIEW"
      && Boolean(this.intelligenceReview?.readyToConfirm)
      && Boolean(this.identityLock && this.identityLock.status === "PENDING_CONFIRMATION")
      && !this.transitioning;
    const canContinueToCreative = Boolean(
      this.identityLock
      && this.identityLock.status === "LOCKED"
      && this.intelligenceStatus === "LOCKED"
      && lockValidation.ok
      && !lockValidation.stale
      && !this.transitioning,
    );

    let continueLabel = "Continue to Video Plan →";
    if (this.saveState === "saving") continueLabel = "Saving…";
    else if (analysisStatus === "UPLOADING") continueLabel = "Uploading…";
    else if (analysisStatus === "ANALYZING" || this.intelligenceStatus === "ANALYZING") continueLabel = "Analyzing…";
    else if (this.intelligenceStatus === "LOCKED") continueLabel = "Continue to Creative Plan →";
    else if (readiness.ready) continueLabel = "Continue to Video Plan →";

    return {
      version: 1,
      projectId: intake.projectId,
      projectName: intake.projectName,
      intake,
      organization: org,
      essentials: { ...this.essentials },
      optional: { ...emptyOptional(), ...this.optional },
      discount,
      analysisStatus,
      aiSummary: aiSummary
        ? { ...aiSummary, heroAssetId }
        : null,
      imageCards,
      readiness,
      saveState: this.saveState,
      canContinue: readiness.ready && !this.transitioning,
      continueBlockedReason: readiness.blockingIssues[0] ?? null,
      continueLabel,
      mediaPreparation: this.mediaPreparation,
      updatedAt: new Date().toISOString(),
      brandContact: { ...emptyBrandContact(), ...this.brandContact },
      videoSettings: { ...emptyVideoSettings(), ...this.videoSettings },
      foundationStatus: this.foundationStatus,
      heroAssetId,
      assetOrder: [...this.assetOrder],
      canMarkReady: readyGate.ok && !this.transitioning,
      readyBlockedReason: readyGate.reason,
      intelligenceStatus: this.intelligenceStatus,
      intelligenceReview: this.intelligenceReview ? { ...this.intelligenceReview } : null,
      identityLock: this.identityLock ? { ...this.identityLock } : null,
      intelligenceError: this.intelligenceError,
      canConfirmIdentityLock,
      canContinueToCreative,
      identityLockBlockedReason: canContinueToCreative
        ? null
        : (lockValidation.issues[0]
          ?? (this.intelligenceStatus === "STALE"
            ? "Product images changed. Re-analyze to refresh the Product Identity Lock."
            : this.intelligenceStatus !== "LOCKED"
              ? "Confirm the Product Identity Lock before creative generation."
              : null)),
      creativeStatus: this.creativeStatus,
      creativeDirection: { ...this.creativeDirection },
      creativeScenes: this.creativeScenes.map((s) => ({ ...s })),
      creativeCapabilities: this.creativeCapabilities.map((c) => ({ ...c })),
      creativePlanId: this.creativePlanId,
      creativePlanStatus: this.creativePlanStatus,
      creativeError: this.creativeError,
      videoReady: this.videoReady,
      renderJobId: this.renderJobId,
      audioRequirements: this.audioRequirements ? { ...this.audioRequirements } : null,
      canGenerateCreativePlan: canContinueToCreative
        && this.creativeStatus !== "PLANNING"
        && this.creativeStatus !== "GENERATING"
        && !this.transitioning,
      canGenerateVideo: canContinueToCreative
        && Boolean(this.creativePlan?.scenes?.length)
        && (this.creativeStatus === "PLAN_READY" || this.creativeStatus === "VIDEO_READY" || this.creativeStatus === "FAILED")
        && this.creativeStatus !== "GENERATING"
        && !this.transitioning,
      creativeBlockedReason: !canContinueToCreative
        ? (lockValidation.issues[0] ?? "Product Identity Lock required before creative production.")
        : this.creativeError,
      produceStatus: this.produceStatus,
      audioLibrary: this.audioLibrary.map((a) => ({ ...a })),
      selectedAudioAssetId: this.selectedAudioAssetId,
      selectedAudioTitle: this.selectedAudioTitle,
      audioEnabled: this.audioEnabled,
      audioVolume: this.audioVolume,
      beatSyncMode: this.beatSyncMode,
      audioIntelligence: this.audioIntelligence ? { ...this.audioIntelligence } : null,
      musicCapability: { ...this.musicCapability },
      timelineReady: this.timelineReady,
      finalRenderJobId: this.finalRenderJobId,
      finalVideoReady: this.finalVideoReady,
      finalOutputUrl: this.finalOutputUrl,
      finalOutputAssetId: this.finalOutputAssetId,
      finalDurationMs: this.finalDurationMs,
      finalWidth: this.finalWidth,
      finalHeight: this.finalHeight,
      produceProgress: this.produceProgress,
      produceStageLabel: produceStageLabel(this.produceProgress, this.produceStatus),
      produceError: this.produceError,
      canRefreshAudioLibrary: Boolean(productIntakeEngine.snapshot().projectId) && !this.transitioning,
      canSelectAudio: Boolean(productIntakeEngine.snapshot().projectId)
        && canContinueToCreative
        && this.videoReady
        && this.produceStatus !== "RENDERING"
        && this.produceStatus !== "QA_IN_PROGRESS"
        && this.produceStatus !== "REGENERATING"
        && !this.transitioning,
      canStartFinalRender: canContinueToCreative
        && this.videoReady
        && this.produceStatus !== "RENDERING"
        && this.produceStatus !== "VALIDATING"
        && this.produceStatus !== "QA_IN_PROGRESS"
        && this.produceStatus !== "REGENERATING"
        && !this.transitioning,
      produceBlockedReason: !canContinueToCreative
        ? (lockValidation.issues[0] ?? "Product Identity Lock required.")
        : !this.videoReady
          ? "Generate Exact Product scenes in Step 3 before final render."
          : this.produceError,
      qaResult: this.qaResult ? { ...this.qaResult, scenes: this.qaResult.scenes.map((s) => ({ ...s })) } : null,
      deliveryStatus: this.deliveryStatus,
      deliveredAt: this.deliveredAt,
      approvedRenderJobId: this.approvedRenderJobId,
      approvedOutputAssetId: this.approvedOutputAssetId,
      targetedRegeneration: this.targetedRegeneration ? { ...this.targetedRegeneration } : null,
      canRunQa: Boolean(productIntakeEngine.snapshot().projectId)
        && this.finalVideoReady
        && Boolean(this.finalOutputUrl)
        && this.produceStatus !== "STALE"
        && this.produceStatus !== "RENDERING"
        && this.produceStatus !== "VALIDATING"
        && this.produceStatus !== "QA_IN_PROGRESS"
        && this.produceStatus !== "REGENERATING"
        && !this.transitioning,
      canRegenerateFailedScene: Boolean(this.qaResult?.scenes.some((s) => s.status === "FAIL"))
        && canContinueToCreative
        && this.produceStatus !== "RENDERING"
        && this.produceStatus !== "QA_IN_PROGRESS"
        && this.produceStatus !== "REGENERATING"
        && !this.transitioning,
      canMarkDelivered: this.produceStatus === "QA_PASSED"
        && this.deliveryStatus !== "DELIVERED"
        && Boolean(this.finalOutputAssetId || this.finalOutputUrl)
        && !this.transitioning,
      qaBlockedReason: !this.finalVideoReady || !this.finalOutputUrl
        ? "Render a final video before quality checks."
        : this.produceStatus === "STALE"
          ? "Final video is stale — re-render before QA."
          : !canContinueToCreative && this.qaResult?.overallStatus !== "QA_PASSED"
            ? (lockValidation.issues[0] ?? "Product Identity Lock must be valid to approve delivery.")
            : this.qaResult?.failures[0] ?? this.produceError,
    };
  }

  private async refreshMediaSummary(projectId: string): Promise<void> {
    try {
      const report = await fetchMediaIntelligence(projectId);
      if (!report?.summary) {
        this.mediaPreparation = null;
        return;
      }
      this.mediaPreparation = {
        ...report.summary,
        statusLabel: formatMediaStatusLabel(report.summary),
      };
    } catch {
      this.mediaPreparation = null;
    }
  }

  setProjectNameLocal(name: string): void {
    productIntakeEngine.setProjectNameLocal(name);
    this.scheduleProjectNamePersist(name);
    this.emit();
  }

  async ensureProject(name?: string): Promise<string> {
    const n = (name ?? productIntakeEngine.snapshot().projectName).trim();
    const id = await productIntakeEngine.ensureProject(n);
    this.emit();
    return id;
  }

  async enqueueFiles(files: FileList | File[]): Promise<void> {
    const list = [...files];
    if (!list.length) return;
    const snap = this.snapshot();
    const name = snap.projectName.trim()
      || suggestProductName(snap.projectName)
      || snap.essentials.productName.trim()
      || `Product ${new Date().toLocaleDateString()}`;
    if (!snap.projectName.trim()) {
      productIntakeEngine.setProjectNameLocal(name);
      this.essentials.productName = this.essentials.productName.trim() || suggestProductName(name) || name;
    }
    // Create/bind project first so uploads never attach to a stale active project.
    // Local preview cards are still staged before network upload work begins.
    await productIntakeEngine.prepareImport(name);
    await productIntakeEngine.stageAndEnqueue(list);
    this.markIntelligenceStaleIfNeeded("Product images were added.");
    this.emit();
  }

  async removeImage(assetId: string): Promise<void> {
    await productIntakeEngine.removeAsset(assetId);
    this.assetOrder = this.assetOrder.filter((id) => id !== assetId);
    if (this.heroAssetId === assetId) this.heroAssetId = null;
    this.markIntelligenceStaleIfNeeded("A product image was removed.");
    this.scheduleEssentialsPersist();
    void this.scheduleAutoAnalysis(true);
    this.emit();
  }

  async setHeroImage(assetId: string): Promise<void> {
    const intake = productIntakeEngine.snapshot();
    const asset = intake.assets.find((a) => a.assetId === assetId && a.processingStatus === "saved");
    if (!asset) throw new Error("Hero image must be a saved project asset.");
    const heroChanged = this.heroAssetId !== assetId;
    this.heroAssetId = assetId;
    if (imageOrganizationEngine.snapshot().productImageSet) {
      await imageOrganizationEngine.setPrimary(assetId);
    }
    if (heroChanged) this.markIntelligenceStaleIfNeeded("Hero image changed.");
    this.scheduleEssentialsPersist();
    this.emit();
  }

  moveImage(assetId: string, direction: "up" | "down"): void {
    const cards = this.orderImageCards(buildImageCards(
      productIntakeEngine.snapshot(),
      imageOrganizationEngine.snapshot(),
    ));
    const ids = cards.map((c) => c.assetId);
    const index = ids.indexOf(assetId);
    if (index < 0) return;
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= ids.length) return;
    const next = [...ids];
    const tmp = next[index]!;
    next[index] = next[swapWith]!;
    next[swapWith] = tmp;
    this.assetOrder = next;
    this.scheduleEssentialsPersist();
    this.emit();
  }

  setBrandContactField<K extends keyof PmvBrandContact>(field: K, value: PmvBrandContact[K]): void {
    this.brandContact[field] = value;
    if (field === "brandName" && typeof value === "string" && !this.optional.brand.trim()) {
      this.optional.brand = value;
    }
    this.scheduleEssentialsPersist();
    this.emit();
  }

  setVideoSettingsField<K extends keyof PmvVideoSettings>(field: K, value: PmvVideoSettings[K]): void {
    this.videoSettings[field] = value;
    this.scheduleEssentialsPersist();
    this.emit();
  }

  async uploadBrandLogo(file: File): Promise<void> {
    const projectId = await this.ensureProject();
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    const dataBase64 = btoa(binary);
    const res = await fetch(`/api/workspace/projects/${projectId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose: "brand-logo",
        fileName: file.name,
        mimeType: file.type || "image/png",
        dataBase64,
      }),
    });
    const body = await res.json() as {
      error?: string;
      logo?: { id: string; url: string; fileName: string };
      image?: { id: string; url: string; fileName: string };
    };
    if (!res.ok) throw new Error(body.error ?? "Logo upload failed");
    const logo = body.logo ?? body.image;
    if (!logo?.id) throw new Error("Logo upload returned no asset id");
    this.brandContact.logoAssetId = logo.id;
    this.brandContact.logoUrl = logo.url;
    this.brandContact.logoFileName = logo.fileName;
    this.scheduleEssentialsPersist();
    this.emit();
  }

  async removeBrandLogo(): Promise<void> {
    const projectId = productIntakeEngine.snapshot().projectId;
    if (!projectId) return;
    const res = await fetch(`/api/workspace/projects/${projectId}/brand-logo`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Unable to remove logo");
    }
    this.brandContact.logoAssetId = null;
    this.brandContact.logoUrl = null;
    this.brandContact.logoFileName = null;
    this.scheduleEssentialsPersist();
    this.emit();
  }

  async markReadyForIntelligence(): Promise<void> {
    const snap = this.snapshot();
    if (!snap.canMarkReady || !snap.projectId) {
      throw new Error(snap.readyBlockedReason ?? "Project is not ready");
    }
    this.foundationStatus = "READY_FOR_INTELLIGENCE";
    await this.flushPersist();
    if (snap.organization.productImageSet) {
      await persistProductImageSet(snap.projectId, snap.organization.productImageSet);
    }
    await persistWorkflowStep(snap.projectId, 1, 1);
    this.emit();
  }

  /** Step 2 — run Product Intelligence via existing server capability (no provider secrets). */
  async runProductIntelligence(): Promise<void> {
    const snap = this.snapshot();
    if (!snap.projectId) throw new Error("Create or open a project first.");
    if (snap.foundationStatus !== "READY_FOR_INTELLIGENCE" && snap.foundationStatus !== "PROCESSING") {
      if (!snap.canMarkReady) {
        throw new Error(snap.readyBlockedReason ?? "Complete product setup before analysis.");
      }
      this.foundationStatus = "READY_FOR_INTELLIGENCE";
    }
    const savedIds = snap.imageCards.filter((c) => c.uploadStatus === "saved").map((c) => c.assetId);
    const heroId = snap.heroAssetId;
    if (!heroId || !savedIds.includes(heroId)) {
      throw new Error("Select a hero image from your uploaded product photos.");
    }

    this.intelligenceStatus = "ANALYZING";
    this.foundationStatus = "PROCESSING";
    this.intelligenceError = null;
    this.emit();

    try {
      await this.flushPersist();
      const result = await analyzeProductIntelligence(snap.projectId);
      if (!result.ok || !result.profile) {
        this.intelligenceStatus = result.unavailable ? "UNAVAILABLE" : "FAILED";
        this.foundationStatus = "READY_FOR_INTELLIGENCE";
        this.intelligenceError = result.error ?? "Product analysis failed.";
        this.intelligenceReview = null;
        this.identityLock = null;
        await this.flushPersist();
        this.emit();
        throw new Error(this.intelligenceError);
      }

      const fingerprint = computeAssetFingerprint(savedIds, heroId);
      const review = buildProductIntelligenceReview(result.profile, heroId);
      const draftLock = buildProductIdentityLock({
        projectId: snap.projectId,
        profile: result.profile,
        heroAssetId: heroId,
        productAssetIds: savedIds,
        assetFingerprint: fingerprint,
      });

      this.intelligenceReview = review;
      this.identityLock = draftLock;
      this.intelligenceAssetFingerprint = fingerprint;
      this.intelligenceError = null;
      this.intelligenceStatus = result.unavailable ? "REVIEW" : "REVIEW";
      this.foundationStatus = "READY_FOR_INTELLIGENCE";
      if (result.unavailable && review.visionUnavailableMessage) {
        this.intelligenceError = null;
      }
      await this.flushPersist();
      await persistWorkflowStep(snap.projectId, 2, 1);
      this.emit();
    } catch (error) {
      if (this.intelligenceStatus === "ANALYZING") {
        this.intelligenceStatus = "FAILED";
        this.foundationStatus = "READY_FOR_INTELLIGENCE";
        this.intelligenceError = error instanceof Error ? error.message : "Product analysis failed.";
        await this.flushPersist().catch(() => undefined);
        this.emit();
      }
      throw error;
    }
  }

  /** Step 2 — customer confirms Product Identity Lock. */
  async confirmProductIdentityLock(): Promise<void> {
    const snap = this.snapshot();
    if (!snap.canConfirmIdentityLock || !snap.identityLock || !snap.projectId) {
      throw new Error(
        snap.identityLockBlockedReason
          ?? "Review Product Intelligence before confirming the Product Identity Lock.",
      );
    }
    if (snap.intelligenceReview && !snap.intelligenceReview.readyToConfirm) {
      throw new Error("Product Intelligence is not ready to lock. Re-analyze or fix warnings.");
    }
    const validation = validateIdentityLock({
      lock: this.identityLock,
      projectId: snap.projectId,
      productAssetIds: snap.imageCards.filter((c) => c.uploadStatus === "saved").map((c) => c.assetId),
      heroAssetId: snap.heroAssetId,
    });
    if (validation.stale) {
      this.markIntelligenceStaleIfNeeded("Product assets changed before confirmation.");
      throw new Error(validation.issues[0] ?? "Product Identity Lock is stale. Re-analyze first.");
    }

    this.identityLock = confirmIdentityLock(this.identityLock!);
    this.intelligenceStatus = "LOCKED";
    this.foundationStatus = "READY_FOR_INTELLIGENCE";
    this.intelligenceError = null;
    await this.flushPersist();
    await persistWorkflowStep(snap.projectId, 2, 2);
    this.emit();
  }

  setCreativeDirectionField<K extends keyof PmvCreativeDirection>(
    field: K,
    value: PmvCreativeDirection[K],
  ): void {
    this.creativeDirection = { ...this.creativeDirection, [field]: value };
    if (field === "energy" || field === "goal") {
      this.creativeDirection.creativeTone = toneFromEnergy(
        this.creativeDirection.energy,
        this.creativeDirection.goal,
      );
    }
    if (field === "generationMode") {
      this.productionMode = mapPmvModeToProduction(value as PmvGenerationMode);
    }
    if (
      field === "musicPreference"
      || field === "voicePreference"
      || field === "mood"
      || field === "energy"
    ) {
      this.audioRequirements = audioRequirementsFromDirection(this.creativeDirection);
    }
    if (this.creativeStatus === "PLAN_READY" || this.creativeStatus === "VIDEO_READY") {
      this.creativeStatus = "STALE";
      this.markCreativeScenesStale();
    }
    this.scheduleEssentialsPersist();
    this.emit();
  }

  async refreshCreativeCapabilities(): Promise<void> {
    const snap = this.snapshot();
    const views = Math.max(1, snap.imageCards.filter((c) => c.uploadStatus === "saved").length);
    try {
      const result = await fetchProductionCapabilities(views);
      this.creativeCapabilities = (result.capabilities ?? []).map((cap) => {
        const pmvMode = mapProductionToPmvMode(cap.mode);
        return {
          mode: pmvMode,
          productionMode: cap.mode,
          label: pmvMode === "EXACT_PRODUCT"
            ? "Exact product"
            : pmvMode === "CINEMATIC"
              ? "Cinematic"
              : "Advanced creative",
          description: cap.description,
          available: cap.available,
          reason: cap.reason,
          limitations: cap.limitations ?? [],
          recommended: cap.recommended,
        };
      });
      // Ensure Exact Product always surfaces even if API omits it.
      if (!this.creativeCapabilities.some((c) => c.mode === "EXACT_PRODUCT")) {
        this.creativeCapabilities.unshift({
          mode: "EXACT_PRODUCT",
          productionMode: "AI_PRODUCT_MOTION",
          label: "Exact product",
          description: "Controlled motion from your real product photos. Highest product fidelity.",
          available: true,
          reason: "Available",
          limitations: [],
          recommended: true,
        });
      }
      this.emit();
    } catch {
      this.creativeCapabilities = [{
        mode: "EXACT_PRODUCT",
        productionMode: "AI_PRODUCT_MOTION",
        label: "Exact product",
        description: "Controlled motion from your real product photos.",
        available: true,
        reason: "Available",
        limitations: [],
        recommended: true,
      }];
      this.emit();
    }
  }

  /** Step 3 — generate creative plan + storyboard (reuses CreativePlanningManager). */
  async generateCreativePlan(regenerate = false): Promise<void> {
    const snap = this.snapshot();
    if (!snap.canGenerateCreativePlan || !snap.projectId) {
      throw new Error(snap.creativeBlockedReason ?? "Confirm Product Identity Lock first.");
    }
    const modeCap = this.creativeCapabilities.find((c) => c.mode === this.creativeDirection.generationMode)
      ?? this.creativeCapabilities.find((c) => c.mode === "EXACT_PRODUCT");
    let productionMode = mapPmvModeToProduction(this.creativeDirection.generationMode);
    if (modeCap && !modeCap.available) {
      if (this.creativeDirection.generationMode === "CINEMATIC"
        || this.creativeDirection.generationMode === "ADVANCED_CREATIVE") {
        // Honest fallback only for Exact Product when cinematic/advanced unavailable.
        productionMode = "AI_PRODUCT_MOTION";
        this.creativeDirection = {
          ...this.creativeDirection,
          generationMode: "EXACT_PRODUCT",
        };
        this.creativeError = modeCap.reason
          || `${pmvModeLabel(modeCap.mode)} is not configured. Using Exact Product mode instead.`;
      } else {
        throw new Error(modeCap.reason || "Selected generation mode is unavailable.");
      }
    }

    this.creativeStatus = "PLANNING";
    this.creativeError = this.creativeError && productionMode === "AI_PRODUCT_MOTION"
      ? this.creativeError
      : null;
    this.emit();

    try {
      await this.flushPersist();
      const duration = snap.videoSettings.durationSeconds || 15;
      const plan = await generatePlanWithMode(
        snap.projectId,
        productionMode,
        this.creativeDirection.creativeTone,
        regenerate || Boolean(this.creativePlan),
        duration,
      );
      this.creativePlan = plan;
      this.creativePlanId = plan.id;
      this.creativePlanStatus = plan.planStatus ?? "READY_FOR_REVIEW";
      this.productionMode = (plan.productionMode as ProductionModeId) || productionMode;
      this.creativeScenes = scenesFromPlan(plan).map((s) => ({ ...s, status: "READY" }));
      this.audioRequirements = audioRequirementsFromDirection(this.creativeDirection);
      this.creativeStatus = "PLAN_READY";
      this.videoReady = false;
      await this.flushPersist();
      await persistWorkflowStep(snap.projectId, 3, 1);
      this.emit();
    } catch (error) {
      this.creativeStatus = "FAILED";
      this.creativeError = customerSafeError(error instanceof Error ? error.message : "Plan generation failed");
      await this.flushPersist().catch(() => undefined);
      this.emit();
      throw new Error(this.creativeError);
    }
  }

  /** Step 3 — finalize plan and render Exact Product (or available mode) video. */
  async generateProductVideo(): Promise<void> {
    const snap = this.snapshot();
    if (!snap.projectId) throw new Error("Create or open a project first.");
    if (!snap.canContinueToCreative) {
      throw new Error(snap.identityLockBlockedReason ?? "Product Identity Lock required.");
    }
    if (!this.creativePlan?.scenes?.length) {
      await this.generateCreativePlan(false);
    }
    if (!this.creativePlan?.scenes?.length) {
      throw new Error("Creative plan has no scenes.");
    }

    this.creativeStatus = "GENERATING";
    this.creativeError = null;
    this.creativeScenes = this.creativeScenes.map((s) => ({ ...s, status: "GENERATING" }));
    this.emit();

    try {
      await finalizeCreativePlan(snap.projectId);
      await createVideoProject(snap.projectId);
      const { job } = await startVideoRender(snap.projectId, "preview");
      this.renderJobId = job.id;
      await this.flushPersist();

      // Poll job until complete (bounded).
      let terminal = job;
      for (let i = 0; i < 90; i += 1) {
        if (terminal.status === "completed" || terminal.status === "failed" || terminal.status === "cancelled") {
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
        const next = await getVideoJob(snap.projectId, terminal.id);
        terminal = next.job;
      }

      if (terminal.status !== "completed") {
        this.creativeStatus = "FAILED";
        this.creativeError = customerSafeError(terminal.error ?? "Video render did not complete.");
        this.creativeScenes = this.creativeScenes.map((s) => ({ ...s, status: "FAILED" }));
        await this.flushPersist();
        this.emit();
        throw new Error(this.creativeError);
      }

      const output = await getVideoOutputDetails(snap.projectId).catch(() => null);
      this.videoReady = Boolean(output?.output || terminal.status === "completed");
      this.creativeStatus = "VIDEO_READY";
      this.creativeScenes = this.creativeScenes.map((s) => ({ ...s, status: "GENERATED" }));
      this.creativePlanStatus = "APPROVED_FOR_VIDEO";
      await this.flushPersist();
      await persistWorkflowStep(snap.projectId, 3, 2);
      this.emit();
    } catch (error) {
      if (this.creativeStatus === "GENERATING") {
        this.creativeStatus = "FAILED";
        this.creativeError = customerSafeError(error instanceof Error ? error.message : "Video generation failed");
        this.creativeScenes = this.creativeScenes.map((s) => (
          s.status === "GENERATING" ? { ...s, status: "FAILED" } : s
        ));
        await this.flushPersist().catch(() => undefined);
        this.emit();
      }
      throw error instanceof Error ? error : new Error(this.creativeError ?? "Video generation failed");
    }
  }

  async refreshVideoOutput(): Promise<boolean> {
    const projectId = productIntakeEngine.snapshot().projectId;
    if (!projectId) return false;
    try {
      const { video } = await getVideoProject(projectId);
      if (!video) return false;
      const output = await getVideoOutputDetails(projectId).catch(() => null);
      this.videoReady = Boolean(output?.output);
      if (this.videoReady) this.creativeStatus = "VIDEO_READY";
      this.timelineReady = Boolean(video.timeline?.length);
      this.emit();
      return this.videoReady;
    } catch {
      return false;
    }
  }

  /** Step 4 — list Audio Library assets (existing library, no duplicate storage). */
  async refreshAudioLibrary(): Promise<void> {
    const projectId = productIntakeEngine.snapshot().projectId;
    try {
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);
      const res = await fetch(`/api/workspace/audio-library?${params.toString()}`);
      const body = await res.json() as { assets?: Record<string, unknown>[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to load audio library");
      this.audioLibrary = (body.assets ?? []).map(mapLibraryItem);
      if (this.selectedAudioAssetId) {
        const selected = this.audioLibrary.find((a) => a.assetId === this.selectedAudioAssetId);
        this.selectedAudioTitle = selected?.title ?? this.selectedAudioTitle;
      }
      this.emit();
    } catch (error) {
      this.produceError = customerSafeError(
        error instanceof Error ? error.message : "Unable to load audio library",
      );
      this.emit();
    }
  }

  async refreshMusicCapability(): Promise<void> {
    try {
      const res = await fetch("/api/workspace/ai-sound/health");
      const body = await res.json() as {
        available?: boolean;
        status?: string;
        reason?: string | null;
        error?: string;
      };
      this.musicCapability = {
        available: Boolean(body.available),
        status: body.status ?? (body.available ? "AVAILABLE" : "UNAVAILABLE"),
        reason: body.reason ?? body.error ?? null,
      };
      this.emit();
    } catch (error) {
      this.musicCapability = {
        available: false,
        status: "UNAVAILABLE",
        reason: error instanceof Error ? error.message : "Music generation unavailable",
      };
      this.emit();
    }
  }

  async selectProjectAudio(assetId: string): Promise<void> {
    const projectId = productIntakeEngine.snapshot().projectId;
    if (!projectId) throw new Error("Create or open a project first.");
    const res = await fetch(`/api/workspace/projects/${projectId}/audio/selection`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    const body = await res.json() as {
      error?: string;
      audio?: Record<string, unknown>;
      analysis?: { intelligence?: Record<string, unknown> | null } | null;
    };
    if (!res.ok) throw new Error(body.error ?? "Unable to select audio");
    const item = body.audio ? mapLibraryItem(body.audio) : null;
    this.selectedAudioAssetId = item?.assetId ?? assetId;
    this.selectedAudioTitle = item?.title ?? null;
    this.audioEnabled = true;
    this.audioIntelligence = mapIntelligence(body.analysis?.intelligence ?? null);
    if (this.produceStatus === "FINAL_READY"
      || this.produceStatus === "QA_PASSED"
      || this.produceStatus === "DELIVERED"
      || this.produceStatus === "QA_FAILED"
      || this.produceStatus === "NEEDS_REVIEW") {
      this.invalidateApprovedDelivery();
    } else if (this.produceStatus === "NOT_STARTED") this.produceStatus = "AUDIO_READY";
    this.finalVideoReady = false;
    await this.flushPersist();
    this.emit();
  }

  async clearProjectAudio(): Promise<void> {
    const projectId = productIntakeEngine.snapshot().projectId;
    if (!projectId) return;
    const res = await fetch(`/api/workspace/projects/${projectId}/audio/selection`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Unable to remove audio");
    }
    this.selectedAudioAssetId = null;
    this.selectedAudioTitle = null;
    this.audioEnabled = false;
    this.audioIntelligence = null;
    if (this.produceStatus === "FINAL_READY"
      || this.produceStatus === "QA_PASSED"
      || this.produceStatus === "DELIVERED"
      || this.produceStatus === "AUDIO_READY") {
      this.produceStatus = this.timelineReady ? "TIMELINE_READY" : "NOT_STARTED";
      if (this.deliveryStatus === "DELIVERED") this.deliveryStatus = "STALE";
    }
    this.finalVideoReady = false;
    await this.flushPersist();
    this.emit();
  }

  async setBeatSyncMode(mode: PmvBeatSyncMode): Promise<void> {
    const projectId = productIntakeEngine.snapshot().projectId;
    if (!projectId) return;
    this.beatSyncMode = mode;
    this.emit();
    const res = await fetch(`/api/workspace/projects/${projectId}/audio/beat-sync`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const body = await res.json() as { error?: string; beatSyncMode?: string; project?: { beatSyncMode?: string } };
    if (!res.ok) throw new Error(body.error ?? "Unable to update beat sync");
    const next = String(body.beatSyncMode ?? body.project?.beatSyncMode ?? mode).toUpperCase();
    this.beatSyncMode = next === "OFF" || next === "STRICT" ? next : "SMART";
    if (this.produceStatus === "FINAL_READY"
      || this.produceStatus === "QA_PASSED"
      || this.produceStatus === "DELIVERED") {
      this.invalidateApprovedDelivery();
    }
    await this.flushPersist();
    this.emit();
  }

  async setAudioVolume(volume: number): Promise<void> {
    const projectId = productIntakeEngine.snapshot().projectId;
    if (!projectId) return;
    const clamped = Math.min(1, Math.max(0, volume));
    this.audioVolume = clamped;
    await updateProjectApi(projectId, { audioVolume: clamped });
    if (this.produceStatus === "FINAL_READY"
      || this.produceStatus === "QA_PASSED"
      || this.produceStatus === "DELIVERED") {
      this.invalidateApprovedDelivery();
    }
    await this.flushPersist();
    this.emit();
  }

  async setAudioVolume(volume: number): Promise<void> {
    const projectId = productIntakeEngine.snapshot().projectId;
    if (!projectId) return;
    const clamped = Math.min(1, Math.max(0, volume));
    this.audioVolume = clamped;
    await updateProjectApi(projectId, { audioVolume: clamped });
    if (this.produceStatus === "FINAL_READY"
      || this.produceStatus === "QA_PASSED"
      || this.produceStatus === "DELIVERED") {
      this.invalidateApprovedDelivery();
    }
    await this.flushPersist();
    this.emit();
  }

  async ensureTimeline(): Promise<void> {
    const snap = this.snapshot();
    if (!snap.projectId) throw new Error("Create or open a project first.");
    if (!snap.canContinueToCreative) {
      throw new Error(snap.identityLockBlockedReason ?? "Product Identity Lock required.");
    }
    if (!this.videoReady && !this.creativePlan?.scenes?.length) {
      throw new Error("Generate Exact Product scenes before building the final timeline.");
    }
    await finalizeCreativePlan(snap.projectId).catch(() => undefined);
    const created = await createVideoProject(snap.projectId);
    this.timelineReady = Boolean(created.video?.timeline?.length);
    this.produceStatus = this.selectedAudioAssetId ? "AUDIO_READY" : "TIMELINE_READY";
    if (this.timelineReady && this.produceStatus === "NOT_STARTED") this.produceStatus = "TIMELINE_READY";
    await this.flushPersist();
    this.emit();
  }

  /** Step 4 — validate + render final advertisement (standard preset). */
  async startFinalRender(force = false, opts?: { regenerateSceneIds?: string[] }): Promise<void> {
    const snap = this.snapshot();
    if (!snap.projectId) throw new Error("Create or open a project first.");
    if (!snap.canContinueToCreative) {
      throw new Error(snap.identityLockBlockedReason ?? "Product Identity Lock required.");
    }
    if (!this.videoReady) {
      throw new Error("Generate Exact Product scenes in Step 3 before final render.");
    }

    this.produceStatus = "RENDERING";
    this.produceProgress = 5;
    this.produceError = null;
    this.emit();

    try {
      await this.flushPersist();
      await finalizeCreativePlan(snap.projectId).catch(() => undefined);

      let payload = await getVideoProject(snap.projectId);
      if (!payload.video?.timeline?.length) {
        this.produceProgress = 10;
        this.emit();
        const created = await createVideoProject(snap.projectId);
        payload = created;
      } else {
        const validation = await validateVideoRender(snap.projectId, "standard");
        if (!validation.validation.ready || force) {
          const created = await createVideoProject(snap.projectId);
          payload = created;
        }
      }
      this.timelineReady = Boolean(payload.video?.timeline?.length);

      this.produceProgress = 15;
      this.emit();
      const { job } = await startVideoRender(
        snap.projectId,
        "standard",
        opts?.regenerateSceneIds?.length
          ? { regenerateSceneIds: opts.regenerateSceneIds }
          : undefined,
      );
      this.finalRenderJobId = job.id;
      await this.flushPersist();

      let terminal = job;
      for (let i = 0; i < 180; i += 1) {
        if (terminal.status === "completed" || terminal.status === "failed" || terminal.status === "cancelled") {
          break;
        }
        const progress = typeof terminal.progress === "number" ? terminal.progress : Math.min(85, 15 + i);
        this.produceProgress = Math.max(this.produceProgress, progress);
        this.produceStatus = "RENDERING";
        this.emit();
        await new Promise((r) => setTimeout(r, 1000));
        const next = await getVideoJob(snap.projectId, terminal.id);
        terminal = next.job;
      }

      if (terminal.status !== "completed") {
        this.produceStatus = "FAILED";
        this.produceError = customerSafeError(terminal.error ?? "Final render did not complete.");
        this.produceProgress = 0;
        await this.flushPersist();
        this.emit();
        throw new Error(this.produceError);
      }

      this.produceStatus = "VALIDATING";
      this.produceProgress = 92;
      this.emit();

      const details = await getVideoOutputDetails(snap.projectId);
      const output = details.output;
      if (!output?.url) {
        throw new Error("Final render completed but no output asset was registered.");
      }
      this.finalOutputUrl = output.url;
      this.finalOutputAssetId = output.assetId ?? null;
      this.finalDurationMs = typeof output.durationMs === "number" ? output.durationMs : null;
      this.finalWidth = typeof output.width === "number" ? output.width : null;
      this.finalHeight = typeof output.height === "number" ? output.height : null;
      this.finalVideoReady = true;
      this.produceStatus = "FINAL_READY";
      this.produceProgress = 100;
      await this.flushPersist();
      await persistWorkflowStep(snap.projectId, 4, 3);
      this.emit();
    } catch (error) {
      if (error instanceof VideoProductionApiError
        && (error.status === 409 || error.code === "RENDER_IN_PROGRESS")
        && this.finalRenderJobId) {
        /* polling path already handles in-progress */
      }
      if (this.produceStatus === "RENDERING" || this.produceStatus === "VALIDATING") {
        this.produceStatus = "FAILED";
        this.produceError = customerSafeError(
          error instanceof Error ? error.message : "Final render failed",
        );
        this.finalVideoReady = false;
        await this.flushPersist().catch(() => undefined);
        this.emit();
      }
      throw error instanceof Error ? error : new Error(this.produceError ?? "Final render failed");
    }
  }

  async refreshFinalOutput(): Promise<boolean> {
    const projectId = productIntakeEngine.snapshot().projectId;
    if (!projectId) return false;
    try {
      const { video } = await getVideoProject(projectId);
      this.timelineReady = Boolean(video?.timeline?.length);
      const details = await getVideoOutputDetails(projectId).catch(() => null);
      const output = details?.output;
      if (output?.url && (video?.outputStatus === "CURRENT" || !video?.outputStatus)) {
        this.finalOutputUrl = output.url;
        this.finalOutputAssetId = output.assetId ?? null;
        this.finalDurationMs = typeof output.durationMs === "number" ? output.durationMs : null;
        this.finalWidth = typeof output.width === "number" ? output.width : null;
        this.finalHeight = typeof output.height === "number" ? output.height : null;
        this.finalVideoReady = true;
        if (
          this.produceStatus !== "STALE"
          && this.produceStatus !== "QA_PASSED"
          && this.produceStatus !== "DELIVERED"
          && this.produceStatus !== "QA_FAILED"
          && this.produceStatus !== "NEEDS_REVIEW"
        ) {
          this.produceStatus = "FINAL_READY";
          this.produceProgress = 100;
        }
        this.emit();
        return true;
      }
      if (video?.outputStatus === "OUTDATED" && this.finalVideoReady) {
        this.invalidateApprovedDelivery();
        this.emit();
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Step 5 — Product Identity QA against final MP4 + identity lock. */
  async runProductVideoQa(): Promise<PmvVideoQaResult> {
    const snap = this.snapshot();
    if (!snap.projectId) throw new Error("Create or open a project first.");
    if (!this.finalVideoReady || !this.finalOutputUrl) {
      throw new Error("Render a final video before quality checks.");
    }
    if (this.produceStatus === "STALE") {
      throw new Error("Final video is stale — re-render before QA.");
    }

    this.produceStatus = "QA_IN_PROGRESS";
    this.produceError = null;
    this.emit();

    try {
      const details = await getVideoOutputDetails(snap.projectId);
      const output = details.output;
      if (!output?.url) throw new Error("Final MP4 is missing from project output.");

      this.finalOutputUrl = output.url;
      this.finalOutputAssetId = output.assetId ?? null;
      this.finalDurationMs = typeof output.durationMs === "number" ? output.durationMs : null;
      this.finalWidth = typeof output.width === "number" ? output.width : null;
      this.finalHeight = typeof output.height === "number" ? output.height : null;
      this.finalRenderJobId = output.renderJobId ?? this.finalRenderJobId;

      const { video } = await getVideoProject(snap.projectId);
      const timelineAssetIds = (video?.timeline ?? [])
        .map((clip) => clip.assetId)
        .filter((id): id is string => Boolean(id));

      const productAssetIds = (() => {
        const intakeIds = productIntakeEngine.snapshot().assets
          .filter((a) => a.processingStatus === "saved")
          .map((a) => a.assetId);
        const timelineIds = timelineAssetIds;
        const outputIds = output.sourceAssetIds ?? [];
        return [...new Set([...intakeIds, ...timelineIds, ...outputIds])];
      })();

      // Authoritative project image set (intake hydrate can be partial).
      const opened = await openProjectApi(snap.projectId).catch(() => null);
      const projectImageIds = (opened?.productImages ?? [])
        .map((img) => {
          const row = img as { id?: string; assetId?: string };
          return row.id ?? row.assetId ?? "";
        })
        .filter(Boolean);
      const qaProductAssetIds = projectImageIds.length
        ? [...new Set([...productAssetIds, ...projectImageIds])]
        : productAssetIds;

      // Vision frame QA is optional; Exact Product Mode uses asset-lock identity.
      // Do not fake PASS when vision is unavailable for generative modes.
      const visionQaAvailable = false;

      const qa = runDeterministicPmvQa({
        projectId: snap.projectId,
        lock: this.identityLock,
        productAssetIds: qaProductAssetIds,
        heroAssetId: this.heroAssetId ?? this.identityLock?.heroAssetId ?? null,
        brandName: this.brandContact.brandName || this.optional.brand || this.essentials.productName,
        website: this.brandContact.websiteUrl || this.optional.website,
        phone: this.brandContact.phone,
        cta: this.videoSettings.cta || this.brandContact.cta || this.optional.productCta,
        logoAssetId: this.brandContact.logoAssetId,
        audioSelected: Boolean(this.selectedAudioAssetId),
        productionMode: this.productionMode,
        scenes: this.creativeScenes,
        timelineAssetIds: timelineAssetIds.length
          ? timelineAssetIds
          : (output.sourceAssetIds ?? []),
        output: {
          assetId: output.assetId,
          url: output.url,
          width: output.width,
          height: output.height,
          durationMs: output.durationMs,
          sizeBytes: output.sizeBytes,
          validationStatus: output.validationStatus,
          validationChecks: output.validationChecks ?? null,
          qualityReview: output.qualityReview ?? null,
          renderJobId: output.renderJobId,
          textOverlay: output.textOverlay ?? null,
          sceneCount: output.sceneCount,
          endCardPresent: output.qualityReview?.checks?.endCardPresent
            ?? output.validationChecks?.endCardPresent
            ?? null,
        },
        visionQaAvailable,
      });

      this.qaResult = qa;
      if (qa.overallStatus === "QA_PASSED") {
        this.produceStatus = "QA_PASSED";
        this.approvedRenderJobId = qa.renderJobId;
        this.approvedOutputAssetId = qa.videoAssetId;
      } else if (qa.overallStatus === "NEEDS_REVIEW") {
        this.produceStatus = "NEEDS_REVIEW";
      } else {
        this.produceStatus = "QA_FAILED";
      }
      await this.flushPersist();
      await persistWorkflowStep(snap.projectId, 5, qa.overallStatus === "QA_PASSED" ? 2 : 1);
      this.emit();
      return qa;
    } catch (error) {
      this.produceStatus = "QA_FAILED";
      this.produceError = customerSafeError(
        error instanceof Error ? error.message : "Quality check failed",
      );
      await this.flushPersist().catch(() => undefined);
      this.emit();
      throw error instanceof Error ? error : new Error(this.produceError);
    }
  }

  /**
   * Step 5 — regenerate ONLY the first failed scene, rebuild timeline, re-render, re-QA.
   * Preserves Product Identity Lock and successful scenes.
   */
  async regenerateFailedScene(sceneId?: string): Promise<PmvVideoQaResult> {
    const snap = this.snapshot();
    if (!snap.projectId) throw new Error("Create or open a project first.");
    if (!this.qaResult) throw new Error("Run quality checks before regenerating a scene.");

    const failed = this.qaResult.scenes.find((s) =>
      (sceneId ? s.sceneId === sceneId : true) && s.status === "FAIL",
    );
    if (!failed) throw new Error("No failed scene to regenerate.");

    const scene = this.creativeScenes.find((s) => s.sceneId === failed.sceneId);
    if (!scene) throw new Error("Failed scene is missing from the storyboard.");

    const previousAttempt = this.sceneRegenAttempts[failed.sceneId] ?? 0;
    if (previousAttempt >= PMV_SCENE_REGEN_MAX_ATTEMPTS) {
      this.produceStatus = "NEEDS_REVIEW";
      this.targetedRegeneration = {
        ...buildTargetedRegeneration({
          projectId: snap.projectId,
          scene,
          qa: this.qaResult,
          lock: this.identityLock,
          productionMode: this.productionMode,
          creativePlanVersion: this.creativePlan?.version ?? null,
          previousAttempt,
        }),
        status: "NEEDS_REVIEW",
        attempt: previousAttempt,
      };
      await this.flushPersist();
      this.emit();
      throw new Error(
        `Scene ${scene.order} needs review after ${PMV_SCENE_REGEN_MAX_ATTEMPTS} regeneration attempts.`,
      );
    }

    const regen = buildTargetedRegeneration({
      projectId: snap.projectId,
      scene,
      qa: this.qaResult,
      lock: this.identityLock,
      productionMode: this.productionMode,
      creativePlanVersion: this.creativePlan?.version ?? null,
      previousAttempt,
    });
    this.targetedRegeneration = { ...regen, status: "REGENERATING" };
    this.produceStatus = "REGENERATING";
    this.creativeScenes = this.creativeScenes.map((s) => (
      s.sceneId === failed.sceneId ? { ...s, status: "GENERATING" } : s
    ));
    this.emit();

    try {
      // Preserve lock + other scenes; only adjust camera/motion on the failed clip.
      const nextMotion = MOTION_OPTIONS[(previousAttempt + 1) % MOTION_OPTIONS.length] ?? "hold";
      const nextCamera = CAMERA_OPTIONS[(previousAttempt + 2) % CAMERA_OPTIONS.length] ?? "hero";

      if (this.creativePlan?.scenes?.length) {
        const scenes = this.creativePlan.scenes.map((planScene) => (
          planScene.id === failed.sceneId
            ? {
              ...planScene,
              motion: nextMotion,
              camera: nextCamera,
              cameraDirection: nextCamera,
              animation: nextMotion,
              userEdited: true,
            }
            : planScene
        ));
        const updated = await updateCreativePlan(snap.projectId, { scenes });
        this.creativePlan = updated.plan;
        this.creativeScenes = scenesFromPlan(updated.plan).map((s) => {
          const prior = this.creativeScenes.find((c) => c.sceneId === s.sceneId);
          if (s.sceneId === failed.sceneId) {
            return { ...s, status: "GENERATED", motion: nextMotion, camera: nextCamera };
          }
          return { ...s, status: prior?.status === "FAILED" ? "GENERATED" : (prior?.status ?? "GENERATED") };
        });
      }

      await updateVideoProject(snap.projectId, {
        clip: {
          id: failed.sceneId,
          motion: nextMotion as import("../../ai/video-production/types").VideoMotionId,
          camera: nextCamera as import("../../ai/video-production/types").VideoCameraId,
        },
      }).catch(async () => {
        // Rebuild timeline from plan if clip update path needs refresh.
        await createVideoProject(snap.projectId);
      });

      this.targetedRegeneration = {
        ...this.targetedRegeneration,
        status: "REPLACED",
        updatedAt: new Date().toISOString(),
      };
      this.sceneRegenAttempts = {
        ...this.sceneRegenAttempts,
        [failed.sceneId]: previousAttempt + 1,
      };
      this.deliveryStatus = this.deliveryStatus === "DELIVERED" ? "STALE" : this.deliveryStatus;
      this.finalVideoReady = false;
      await this.flushPersist();

      await this.startFinalRender(true, { regenerateSceneIds: [failed.sceneId] });
      const qa = await this.runProductVideoQa();
      return qa;
    } catch (error) {
      this.produceStatus = "QA_FAILED";
      this.targetedRegeneration = this.targetedRegeneration
        ? { ...this.targetedRegeneration, status: "FAILED", updatedAt: new Date().toISOString() }
        : null;
      this.creativeScenes = this.creativeScenes.map((s) => (
        s.sceneId === failed.sceneId ? { ...s, status: "FAILED" } : s
      ));
      this.produceError = customerSafeError(
        error instanceof Error ? error.message : "Scene regeneration failed",
      );
      await this.flushPersist().catch(() => undefined);
      this.emit();
      throw error instanceof Error ? error : new Error(this.produceError);
    }
  }

  /** Step 5 — mark QA-passed final as delivered (current approved output). */
  async markDelivered(): Promise<void> {
    const snap = this.snapshot();
    if (!snap.projectId) throw new Error("Create or open a project first.");
    if (this.produceStatus !== "QA_PASSED") {
      throw new Error("Final video must pass QA before delivery.");
    }
    if (!this.finalOutputAssetId && !this.finalOutputUrl) {
      throw new Error("No approved final video asset to deliver.");
    }
    this.deliveryStatus = "DELIVERED";
    this.deliveredAt = new Date().toISOString();
    this.approvedRenderJobId = this.qaResult?.renderJobId ?? this.finalRenderJobId;
    this.approvedOutputAssetId = this.qaResult?.videoAssetId ?? this.finalOutputAssetId;
    this.produceStatus = "DELIVERED";
    await this.flushPersist();
    await persistWorkflowStep(snap.projectId, 5, 3);
    this.emit();
  }

  private invalidateApprovedDelivery(): void {
    const wasApproved = this.produceStatus === "QA_PASSED"
      || this.produceStatus === "DELIVERED"
      || this.produceStatus === "QA_FAILED"
      || this.produceStatus === "NEEDS_REVIEW"
      || this.produceStatus === "FINAL_READY"
      || this.deliveryStatus === "DELIVERED";
    if (!wasApproved && !this.finalVideoReady) return;
    this.produceStatus = "STALE";
    this.finalVideoReady = false;
    if (this.deliveryStatus === "DELIVERED" || this.qaResult?.overallStatus === "QA_PASSED") {
      this.deliveryStatus = "STALE";
    }
  }

  async saveDraft(): Promise<void> {
    await this.ensureProject();
    if (
      this.foundationStatus !== "READY_FOR_INTELLIGENCE"
      && this.foundationStatus !== "PROCESSING"
    ) {
      this.foundationStatus = "DRAFT";
    }
    await this.flushPersist();
    this.emit();
  }

  async retryFailedUploads(): Promise<void> {
    await productIntakeEngine.retryFailed();
    this.emit();
  }

  confirmRemotePreview(assetId: string): void {
    productIntakeEngine.confirmRemotePreview(assetId);
  }

  keepDuplicate(assetId: string): void {
    productIntakeEngine.keepDuplicate(assetId);
    imageOrganizationEngine.keepDuplicate(assetId);
    this.emit();
  }

  async reclassifyImage(assetId: string, viewType: OrganizationViewType): Promise<void> {
    await imageOrganizationEngine.reclassify(assetId, viewType);
    this.emit();
  }

  setEssentialField<K extends keyof ProductEssentials>(field: K, value: ProductEssentials[K]): void {
    this.essentials[field] = value;
    this.scheduleEssentialsPersist();
    this.emit();
  }

  setOptionalField<K extends keyof OptionalProductDetails>(field: K, value: OptionalProductDetails[K]): void {
    this.optional[field] = value;
    this.scheduleEssentialsPersist();
    this.emit();
  }

  applySuggestedProductName(): void {
    const suggested = suggestProductName(productIntakeEngine.snapshot().projectName);
    if (suggested) {
      this.essentials.productName = suggested;
      this.scheduleEssentialsPersist();
      this.emit();
    }
  }

  async retryAnalysis(): Promise<void> {
    this.analysisFailed = false;
    await this.runAnalysis();
  }

  private async scheduleAutoAnalysis(force = false): Promise<void> {
    const intake = productIntakeEngine.snapshot();
    const org = imageOrganizationEngine.snapshot();
    const valid = intake.assets.filter((a) => a.processingStatus === "saved" && a.validationStatus !== "invalid").length;
    if (!intake.projectId || valid < 1) return;
    if (org.progress.running) return;
    if (!force && org.productImageSet && org.productImageSet.images.length === valid) return;
    if (this.autoAnalysisQueued) return;
    this.autoAnalysisQueued = true;
    try {
      await this.ensureProject();
      await imageOrganizationEngine.hydrateFromHandoff();
      await this.runAnalysis();
    } finally {
      this.autoAnalysisQueued = false;
    }
  }

  private async runAnalysis(): Promise<void> {
    try {
      await imageOrganizationEngine.runAnalysis();
      this.analysisFailed = false;
      const intake = productIntakeEngine.snapshot();
      if (intake.projectId) {
        await this.refreshMediaSummary(intake.projectId);
      }
    } catch {
      this.analysisFailed = true;
    }
    this.emit();
  }

  private scheduleProjectNamePersist(name: string): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.saveState = "unsaved";
    this.persistTimer = setTimeout(() => {
      void this.flushPersist().catch(() => {
        this.saveState = "error";
        this.emit();
      });
    }, 700);
  }

  private scheduleEssentialsPersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.saveState = "unsaved";
    this.persistTimer = setTimeout(() => {
      void this.flushPersist().catch(() => {
        this.saveState = "error";
        this.emit();
      });
    }, 700);
  }

  async flushPersist(): Promise<void> {
    const intake = productIntakeEngine.snapshot();
    if (!intake.projectId) return;
    this.saveState = "saving";
    this.emit();
    const discount = calculateDiscount(this.essentials.previousPrice, this.essentials.currentPrice);
    const features = this.optional.features.trim()
      ? this.optional.features.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
      : undefined;

    if (this.serviceMode !== "pmv") {
      await updateProjectApi(intake.projectId, {
        name: intake.projectName.trim() || undefined,
        productInformation: {
          name: this.essentials.productName.trim(),
          price: this.essentials.currentPrice ?? undefined,
          originalPrice: this.essentials.previousPrice ?? undefined,
          discount: discount.valid ? discount.percent ?? undefined : undefined,
          currency: this.essentials.currency.trim() || "RWF",
          shortDescription: this.essentials.shortDescription.trim() || undefined,
          brand: this.optional.brand.trim() || undefined,
          colors: this.optional.color.trim() ? [this.optional.color.trim()] : undefined,
          materials: this.optional.material.trim() ? [this.optional.material.trim()] : undefined,
          features,
          sizes: this.essentials.size.trim() ? [this.essentials.size.trim()] : undefined,
          additionalNotes: this.optional.notes.trim() || undefined,
          specifications: this.optional.website.trim()
            ? { website: this.optional.website.trim() }
            : undefined,
        },
      });
      this.saveState = "saved";
      workspaceStateEngine.autoSave.markDirty();
      this.emit();
      return;
    }

    const cta = this.videoSettings.cta.trim()
      || this.brandContact.cta.trim()
      || this.optional.productCta.trim()
      || undefined;
    const benefits = this.optional.benefits.trim()
      ? this.optional.benefits.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
      : undefined;
    const pmvSettings: PmvFoundationSettings = {
      foundationStatus: this.foundationStatus,
      heroAssetId: this.heroAssetId,
      assetOrder: [...this.assetOrder],
      durationSeconds: this.videoSettings.durationSeconds,
      aspectRatio: this.videoSettings.aspectRatio,
      intelligenceStatus: this.intelligenceStatus,
      intelligenceProfileId: this.intelligenceReview?.profileId ?? this.identityLock?.profileId ?? null,
      intelligenceAnalysisVersion: this.intelligenceReview?.analysisVersion
        ?? this.identityLock?.analysisVersion
        ?? null,
      intelligenceAssetFingerprint: this.intelligenceAssetFingerprint,
      intelligenceError: this.intelligenceError,
      intelligenceReview: this.intelligenceReview,
      creativeStatus: this.creativeStatus,
      creativeDirection: this.creativeDirection,
      creativePlanId: this.creativePlanId,
      creativePlanVersion: this.creativePlan?.version ?? null,
      creativePlanStatus: this.creativePlanStatus,
      productionMode: this.productionMode,
      renderJobId: this.renderJobId,
      videoReady: this.videoReady,
      creativeError: this.creativeError,
      audioRequirements: this.audioRequirements,
      produceStatus: this.produceStatus,
      finalRenderJobId: this.finalRenderJobId,
      finalVideoReady: this.finalVideoReady,
      finalOutputAssetId: this.finalOutputAssetId,
      finalOutputUrl: this.finalOutputUrl,
      beatSyncMode: this.beatSyncMode,
      audioVolume: this.audioVolume,
      selectedAudioAssetId: this.selectedAudioAssetId,
      qaResult: this.qaResult,
      deliveryStatus: this.deliveryStatus,
      deliveredAt: this.deliveredAt,
      approvedRenderJobId: this.approvedRenderJobId,
      approvedOutputAssetId: this.approvedOutputAssetId,
      targetedRegeneration: this.targetedRegeneration,
      sceneRegenAttempts: { ...this.sceneRegenAttempts },
    };
    const language = this.videoSettings.language.trim()
      || this.brandContact.language.trim()
      || "en";
    const platform = aspectToPlatform(this.videoSettings.aspectRatio);
    await updateProjectApi(intake.projectId, {
      name: intake.projectName.trim() || undefined,
      language,
      platform,
      productInformation: {
        name: this.essentials.productName.trim(),
        category: this.optional.productCategory.trim() || "Product",
        description: this.optional.longDescription.trim()
          || this.essentials.shortDescription.trim()
          || this.essentials.productName.trim(),
        price: this.essentials.currentPrice ?? undefined,
        originalPrice: this.essentials.previousPrice ?? undefined,
        discount: discount.valid ? discount.percent ?? undefined : undefined,
        currency: this.essentials.currency.trim() || "RWF",
        shortDescription: this.essentials.shortDescription.trim() || undefined,
        brand: this.brandContact.brandName.trim() || this.optional.brand.trim() || undefined,
        colors: this.optional.color.trim() ? [this.optional.color.trim()] : undefined,
        materials: this.optional.material.trim() ? [this.optional.material.trim()] : undefined,
        features,
        benefits,
        sizes: this.essentials.size.trim() ? [this.essentials.size.trim()] : undefined,
        additionalNotes: [
          this.optional.notes.trim(),
          this.optional.offer.trim() ? `Offer: ${this.optional.offer.trim()}` : "",
        ].filter(Boolean).join("\n") || undefined,
        website: this.brandContact.websiteUrl.trim() || this.optional.website.trim() || undefined,
        phone: this.brandContact.phone.trim() || undefined,
        email: this.brandContact.email.trim() || undefined,
        callToAction: cta,
        cta,
        specifications: {
          ...(this.optional.website.trim() || this.brandContact.websiteUrl.trim()
            ? { website: this.brandContact.websiteUrl.trim() || this.optional.website.trim() }
            : {}),
          ...(this.optional.offer.trim() ? { offer: this.optional.offer.trim() } : {}),
          ...(this.optional.longDescription.trim()
            ? { longDescription: this.optional.longDescription.trim() }
            : {}),
        },
      },
      brandInformation: {
        name: this.brandContact.brandName.trim()
          || this.optional.brand.trim()
          || this.essentials.productName.trim()
          || intake.projectName.trim()
          || "Brand",
        website: this.brandContact.websiteUrl.trim() || undefined,
        phone: this.brandContact.phone.trim() || undefined,
        whatsapp: this.brandContact.whatsapp.trim() || undefined,
        logoAssetId: this.brandContact.logoAssetId || undefined,
      },
      campaignInformation: {
        name: `${this.essentials.productName.trim() || intake.projectName.trim() || "Product"} campaign`,
        objective: "Showcase product value",
        callToAction: cta,
        duration: `${this.videoSettings.durationSeconds}s`,
        customDurationSeconds: this.videoSettings.durationSeconds,
        platforms: [platform],
        contentFormat: "short-form video",
      },
      workspaceSettings: {
        [PMV_SETTINGS_KEY]: pmvSettings,
        [PMV_IDENTITY_LOCK_KEY]: this.identityLock,
        serviceKey: "product-marketing-video",
      },
    });
    this.saveState = "saved";
    workspaceStateEngine.autoSave.markDirty();
    this.emit();
  }

  async continueToStep2(): Promise<Step2HandoffPayload> {
    const snap = this.snapshot();
    if (!snap.canContinue || !snap.projectId) {
      throw new Error(snap.continueBlockedReason ?? "Step 1 is not ready");
    }
    if (this.transitioning) throw new Error("Step transition already in progress.");
    this.transitioning = true;
    try {
      await this.ensureProject(snap.projectName);
      if (snap.analysisStatus === "NOT_STARTED" || !snap.organization.productImageSet) {
        await this.runAnalysis();
      }
      const org = imageOrganizationEngine.snapshot();
      if (!org.productImageSet) throw new Error("AI analysis did not complete. Retry analysis or review images.");
      await this.flushPersist();
      await persistProductImageSet(snap.projectId, org.productImageSet);
      const handoff: Step2HandoffPayload = {
        version: 1,
        step: "step-2-video-requirements",
        projectId: snap.projectId,
        projectName: snap.projectName,
        productImageSet: org.productImageSet,
        essentials: { ...this.essentials },
        optional: { ...this.optional },
        discount: snap.discount,
        category: org.productImageSet.categoryEstimate ?? null,
        preparedAt: new Date().toISOString(),
      };
      writeScopedHandoff(SETUP_HANDOFF_KEY, handoff);
      await persistWorkflowStep(snap.projectId, 2, 1);
      await openProjectApi(snap.projectId);
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      console.info("[STEP_1_UNIFIED_COMPLETED]", { projectId: snap.projectId });
      this.emit();
      return handoff;
    } finally {
      this.transitioning = false;
    }
  }

  private essentialsFromProject(project: Awaited<ReturnType<typeof openProjectApi>>): ProductEssentials {
    const info = project.productInformation ?? {};
    const sizes = Array.isArray(info.sizes) ? info.sizes.map(String) : [];
    return {
      productName: typeof info.name === "string" ? info.name : "",
      currentPrice: typeof info.price === "number" ? info.price : null,
      previousPrice: typeof info.originalPrice === "number" ? info.originalPrice : null,
      currency: typeof info.currency === "string" ? info.currency : "RWF",
      size: sizes[0] ?? "",
      shortDescription: typeof info.shortDescription === "string" ? info.shortDescription : "",
    };
  }

  private optionalFromProject(project: Awaited<ReturnType<typeof openProjectApi>>): OptionalProductDetails {
    const info = project.productInformation ?? {};
    const specs = (info.specifications && typeof info.specifications === "object")
      ? info.specifications as Record<string, string>
      : {};
    const offerFromNotes = typeof info.additionalNotes === "string"
      ? (info.additionalNotes.match(/^Offer:\s*(.+)$/m)?.[1] ?? "")
      : "";
    return {
      brand: typeof info.brand === "string" ? info.brand : "",
      color: Array.isArray(info.colors) ? info.colors.map(String).join(", ") : "",
      material: Array.isArray(info.materials) ? info.materials.map(String).join(", ") : "",
      features: Array.isArray(info.features) ? info.features.map(String).join(", ") : "",
      website: specs.website ?? (typeof info.website === "string" ? info.website : ""),
      notes: typeof info.additionalNotes === "string"
        ? info.additionalNotes.replace(/^Offer:\s*.+$/m, "").trim()
        : "",
      longDescription: specs.longDescription
        ?? (typeof info.description === "string" && info.description !== info.shortDescription
          ? info.description
          : ""),
      benefits: Array.isArray(info.benefits) ? info.benefits.map(String).join(", ") : "",
      offer: specs.offer ?? offerFromNotes,
      productCategory: typeof info.category === "string" && info.category !== "Product" ? info.category : "",
      productCta: typeof info.callToAction === "string"
        ? info.callToAction
        : typeof info.cta === "string"
          ? info.cta
          : "",
    };
  }

  private brandFromProject(project: Awaited<ReturnType<typeof openProjectApi>>): PmvBrandContact {
    const brand = project.brandInformation ?? { name: "" };
    const info = project.productInformation ?? {};
    const logoId = brand.logoAssetId?.trim() || null;
    const logoImage = logoId
      ? project.productImages?.find((img) => img.id === logoId)
      : undefined;
    return {
      brandName: brand.name?.trim() || (typeof info.brand === "string" ? info.brand : ""),
      websiteName: brand.name?.trim() || "",
      websiteUrl: brand.website?.trim()
        || (typeof info.website === "string" ? info.website : "")
        || "",
      phone: brand.phone?.trim() || (typeof info.phone === "string" ? info.phone : "") || "",
      whatsapp: brand.whatsapp?.trim() || "",
      email: typeof info.email === "string" ? info.email : "",
      cta: project.campaignInformation?.callToAction?.trim()
        || (typeof info.callToAction === "string" ? info.callToAction : "")
        || (typeof info.cta === "string" ? info.cta : "")
        || "",
      language: project.language?.trim() || "en",
      logoAssetId: logoId,
      logoUrl: logoImage?.url ?? null,
      logoFileName: logoImage?.fileName ?? null,
    };
  }

  private videoSettingsFromProject(project: Awaited<ReturnType<typeof openProjectApi>>): PmvVideoSettings {
    const campaign = project.campaignInformation;
    const stored = this.readPmvSettings(project.workspaceSettings);
    const duration = stored?.durationSeconds
      ?? campaign?.customDurationSeconds
      ?? (typeof campaign?.duration === "string"
        ? Number.parseInt(campaign.duration, 10) || 15
        : 15);
    return {
      durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : 15,
      aspectRatio: stored?.aspectRatio ?? platformToAspect(project.platform),
      language: project.language?.trim() || "en",
      cta: campaign?.callToAction?.trim() || "",
    };
  }

  private applyPmvSettings(workspaceSettings: Record<string, unknown> | undefined): void {
    const stored = this.readPmvSettings(workspaceSettings);
    if (!stored) return;
    this.foundationStatus = stored.foundationStatus ?? "DRAFT";
    this.heroAssetId = stored.heroAssetId ?? null;
    this.assetOrder = Array.isArray(stored.assetOrder) ? stored.assetOrder.map(String) : [];
    if (stored.durationSeconds) this.videoSettings.durationSeconds = stored.durationSeconds;
    if (stored.aspectRatio) this.videoSettings.aspectRatio = stored.aspectRatio;
    if (stored.intelligenceStatus) this.intelligenceStatus = stored.intelligenceStatus;
    if (stored.intelligenceReview) this.intelligenceReview = stored.intelligenceReview;
    if (stored.intelligenceAssetFingerprint !== undefined) {
      this.intelligenceAssetFingerprint = stored.intelligenceAssetFingerprint ?? null;
    }
    if (stored.intelligenceError !== undefined) {
      this.intelligenceError = stored.intelligenceError ?? null;
    }
    if (stored.creativeStatus) this.creativeStatus = stored.creativeStatus;
    if (stored.creativeDirection) {
      this.creativeDirection = { ...DEFAULT_PMV_CREATIVE_DIRECTION(), ...stored.creativeDirection };
    }
    if (stored.creativePlanId !== undefined) this.creativePlanId = stored.creativePlanId ?? null;
    if (stored.creativePlanStatus !== undefined) this.creativePlanStatus = stored.creativePlanStatus ?? null;
    if (stored.productionMode) this.productionMode = stored.productionMode as ProductionModeId;
    if (stored.renderJobId !== undefined) this.renderJobId = stored.renderJobId ?? null;
    if (stored.videoReady !== undefined) this.videoReady = Boolean(stored.videoReady);
    if (stored.creativeError !== undefined) this.creativeError = stored.creativeError ?? null;
    if (stored.audioRequirements) this.audioRequirements = stored.audioRequirements;
    else if (stored.creativeDirection) {
      this.audioRequirements = audioRequirementsFromDirection(this.creativeDirection);
    }
    if (stored.produceStatus) this.produceStatus = stored.produceStatus;
    if (stored.finalRenderJobId !== undefined) this.finalRenderJobId = stored.finalRenderJobId ?? null;
    if (stored.finalVideoReady !== undefined) this.finalVideoReady = Boolean(stored.finalVideoReady);
    if (stored.finalOutputAssetId !== undefined) this.finalOutputAssetId = stored.finalOutputAssetId ?? null;
    if (stored.finalOutputUrl !== undefined) this.finalOutputUrl = stored.finalOutputUrl ?? null;
    if (stored.beatSyncMode) this.beatSyncMode = stored.beatSyncMode;
    if (typeof stored.audioVolume === "number") this.audioVolume = stored.audioVolume;
    if (stored.selectedAudioAssetId !== undefined) {
      this.selectedAudioAssetId = stored.selectedAudioAssetId ?? null;
    }
    if (stored.qaResult) this.qaResult = stored.qaResult;
    if (stored.deliveryStatus) this.deliveryStatus = stored.deliveryStatus;
    if (stored.deliveredAt !== undefined) this.deliveredAt = stored.deliveredAt ?? null;
    if (stored.approvedRenderJobId !== undefined) {
      this.approvedRenderJobId = stored.approvedRenderJobId ?? null;
    }
    if (stored.approvedOutputAssetId !== undefined) {
      this.approvedOutputAssetId = stored.approvedOutputAssetId ?? null;
    }
    if (stored.targetedRegeneration) this.targetedRegeneration = stored.targetedRegeneration;
    if (stored.sceneRegenAttempts && typeof stored.sceneRegenAttempts === "object") {
      this.sceneRegenAttempts = { ...stored.sceneRegenAttempts };
    }
  }

  private applyProjectAudio(project: Awaited<ReturnType<typeof openProjectApi>>): void {
    const selected = typeof project.selectedAudioAssetId === "string"
      ? project.selectedAudioAssetId
      : this.selectedAudioAssetId;
    this.selectedAudioAssetId = selected || null;
    this.audioEnabled = Boolean(project.audioEnabled ?? this.selectedAudioAssetId);
    if (typeof project.audioVolume === "number") this.audioVolume = project.audioVolume;
    const mode = String(project.beatSyncMode ?? this.beatSyncMode).toUpperCase();
    this.beatSyncMode = mode === "OFF" || mode === "STRICT" ? mode : "SMART";
  }

  private async hydrateCreativePlan(projectId: string): Promise<void> {
    try {
      const { plan } = await getCreativePlan(projectId);
      if (!plan) return;
      this.creativePlan = plan;
      this.creativePlanId = plan.id;
      this.creativePlanStatus = plan.planStatus ?? this.creativePlanStatus;
      this.productionMode = (plan.productionMode as ProductionModeId) || this.productionMode;
      const sceneStatus = this.creativeStatus === "VIDEO_READY" ? "GENERATED"
        : this.creativeStatus === "FAILED" ? "FAILED"
          : this.creativeStatus === "STALE" ? "STALE"
            : "READY";
      this.creativeScenes = scenesFromPlan(plan).map((s) => ({ ...s, status: sceneStatus }));
      await this.refreshVideoOutput();
      this.emit();
    } catch {
      /* keep persisted summary */
    }
  }

  private markCreativeScenesStale(): void {
    this.creativeScenes = this.creativeScenes.map((s) => ({ ...s, status: "STALE" }));
    this.videoReady = false;
    if (
      this.produceStatus === "FINAL_READY"
      || this.produceStatus === "QA_PASSED"
      || this.produceStatus === "DELIVERED"
      || this.produceStatus === "QA_FAILED"
      || this.produceStatus === "NEEDS_REVIEW"
      || this.finalVideoReady
    ) {
      this.invalidateApprovedDelivery();
    }
  }

  private applyIdentityLock(workspaceSettings: Record<string, unknown> | undefined): void {
    if (!workspaceSettings || typeof workspaceSettings !== "object") return;
    const raw = workspaceSettings[PMV_IDENTITY_LOCK_KEY];
    if (!raw || typeof raw !== "object") {
      this.identityLock = null;
      return;
    }
    this.identityLock = raw as ProductIdentityLock;
  }

  private async hydrateIntelligenceProfile(projectId: string): Promise<void> {
    try {
      const profile = await fetchProductIntelligenceProfile(projectId);
      if (!profile) return;
      const heroId = this.heroAssetId
        ?? profile.imageIds[0]
        ?? null;
      this.intelligenceReview = buildProductIntelligenceReview(profile, heroId);
      if (!this.identityLock && this.intelligenceStatus === "REVIEW") {
        const savedIds = productIntakeEngine.snapshot().assets
          .filter((a) => a.processingStatus === "saved")
          .map((a) => a.assetId);
        if (heroId && savedIds.length) {
          this.identityLock = buildProductIdentityLock({
            projectId,
            profile,
            heroAssetId: heroId,
            productAssetIds: savedIds,
            assetFingerprint: computeAssetFingerprint(savedIds, heroId),
          });
        }
      }
      this.emit();
    } catch {
      /* keep persisted review */
    }
  }

  private currentAssetFingerprint(): string {
    const intake = productIntakeEngine.snapshot();
    const ids = intake.assets
      .filter((a) => a.processingStatus === "saved")
      .map((a) => a.assetId);
    return computeAssetFingerprint(ids, this.heroAssetId);
  }

  private refreshStaleLockState(): void {
    if (this.serviceMode !== "pmv") return;
    if (!this.identityLock && this.intelligenceStatus === "NOT_STARTED") return;
    const fingerprint = this.currentAssetFingerprint();
    if (!this.intelligenceAssetFingerprint) {
      this.intelligenceAssetFingerprint = this.identityLock?.assetFingerprint ?? fingerprint;
    }
    if (
      this.intelligenceAssetFingerprint
      && this.intelligenceAssetFingerprint !== fingerprint
      && (this.intelligenceStatus === "LOCKED"
        || this.intelligenceStatus === "REVIEW"
        || this.identityLock?.status === "LOCKED"
        || this.identityLock?.status === "PENDING_CONFIRMATION")
    ) {
      this.markIntelligenceStaleIfNeeded("Product assets changed.");
    }
  }

  private markIntelligenceStaleIfNeeded(_reason: string): void {
    if (this.serviceMode !== "pmv") return;
    if (
      this.intelligenceStatus === "NOT_STARTED"
      && !this.identityLock
      && !this.intelligenceReview
    ) {
      return;
    }
    if (this.intelligenceStatus === "ANALYZING") return;

    const shouldStale = this.intelligenceStatus === "LOCKED"
      || this.intelligenceStatus === "REVIEW"
      || this.identityLock?.status === "LOCKED"
      || this.identityLock?.status === "PENDING_CONFIRMATION";

    if (!shouldStale && this.intelligenceStatus !== "STALE") return;

    if (this.identityLock) {
      this.identityLock = markIdentityLockStale(this.identityLock);
    }
    this.intelligenceStatus = "STALE";
    this.intelligenceAssetFingerprint = this.currentAssetFingerprint();
    if (
      this.creativeStatus === "PLAN_READY"
      || this.creativeStatus === "VIDEO_READY"
      || this.creativeStatus === "PLANNING"
    ) {
      this.creativeStatus = "STALE";
      this.markCreativeScenesStale();
    }
    this.scheduleEssentialsPersist();
  }

  private readPmvSettings(workspaceSettings: Record<string, unknown> | undefined): PmvFoundationSettings | null {
    if (!workspaceSettings || typeof workspaceSettings !== "object") return null;
    const raw = workspaceSettings[PMV_SETTINGS_KEY];
    if (!raw || typeof raw !== "object") return null;
    return raw as PmvFoundationSettings;
  }

  private orderImageCards(
    cards: import("./types").ImageCardModel[],
  ): import("./types").ImageCardModel[] {
    const ids = cards.map((c) => c.assetId);
    if (!this.assetOrder.length) {
      this.assetOrder = ids;
    } else {
      const known = new Set(this.assetOrder);
      for (const id of ids) {
        if (!known.has(id)) this.assetOrder.push(id);
      }
      this.assetOrder = this.assetOrder.filter((id) => ids.includes(id));
    }
    if (!this.assetOrder.length) return cards;
    const rank = new Map(this.assetOrder.map((id, index) => [id, index]));
    return [...cards].sort((a, b) => {
      const ai = rank.has(a.assetId) ? rank.get(a.assetId)! : Number.MAX_SAFE_INTEGER;
      const bi = rank.has(b.assetId) ? rank.get(b.assetId)! : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }

  private computeReadyGate(
    projectId: string | null,
    heroAssetId: string | null,
    imageCards: import("./types").ImageCardModel[],
    readiness: import("./types").ReadinessResult,
  ): { ok: boolean; reason: string | null } {
    if (!projectId) return { ok: false, reason: "Create or open a project first." };
    const saved = imageCards.filter((c) => c.uploadStatus === "saved");
    if (saved.length < 1) return { ok: false, reason: "Upload at least one product image." };
    if (!this.essentials.productName.trim()) return { ok: false, reason: "Product name is required." };
    if (heroAssetId && !saved.some((c) => c.assetId === heroAssetId)) {
      return { ok: false, reason: "Hero image must be one of the project assets." };
    }
    if (!heroAssetId) return { ok: false, reason: "Select a hero image." };
    if (readiness.blockingIssues.some((issue) => /upload|analyz/i.test(issue))) {
      return { ok: false, reason: readiness.blockingIssues[0] ?? null };
    }
    return { ok: true, reason: null };
  }

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }
}

export const productSetupEngine = new ProductSetupEngine();
