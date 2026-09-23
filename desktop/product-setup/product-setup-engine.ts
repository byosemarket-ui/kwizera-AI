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
        this.refreshStaleLockState();
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
