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
  ProductEssentials,
  ProductSetupSnapshot,
  SaveState,
  Step2HandoffPayload,
} from "./types";

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
});

export class ProductSetupEngine {
  private essentials = emptyEssentials();
  private optional = emptyOptional();
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
    const imageCards = buildImageCards(intake, org);
    const aiSummary = buildAiSummary(org, this.essentials);
    const readiness = computeReadiness(intake, org, this.essentials, analysisStatus);

    let continueLabel = "Continue to Video Plan →";
    if (this.saveState === "saving") continueLabel = "Saving…";
    else if (analysisStatus === "UPLOADING") continueLabel = "Uploading…";
    else if (analysisStatus === "ANALYZING") continueLabel = "Analyzing…";
    else if (readiness.ready) continueLabel = "Continue to Video Plan →";

    return {
      version: 1,
      projectId: intake.projectId,
      projectName: intake.projectName,
      intake,
      organization: org,
      essentials: { ...this.essentials },
      optional: { ...this.optional },
      discount,
      analysisStatus,
      aiSummary,
      imageCards,
      readiness,
      saveState: this.saveState,
      canContinue: readiness.ready && !this.transitioning,
      continueBlockedReason: readiness.blockingIssues[0] ?? null,
      continueLabel,
      mediaPreparation: this.mediaPreparation,
      updatedAt: new Date().toISOString(),
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
    // Stage previews immediately; prepare project in parallel so UI is not blocked.
    void productIntakeEngine.stageAndEnqueue(list);
    void productIntakeEngine.prepareImport(name).catch((error) => {
      this.notify?.("error", "Project not ready", error instanceof Error ? error.message : String(error), "errors");
    });
    this.emit();
  }

  async removeImage(assetId: string): Promise<void> {
    await productIntakeEngine.removeAsset(assetId);
    void this.scheduleAutoAnalysis(true);
    this.emit();
  }

  async retryFailedUploads(): Promise<void> {
    await productIntakeEngine.retryFailed();
    this.emit();
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
        features: this.optional.features.trim()
          ? this.optional.features.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
          : undefined,
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
    return {
      brand: typeof info.brand === "string" ? info.brand : "",
      color: Array.isArray(info.colors) ? info.colors.map(String).join(", ") : "",
      material: Array.isArray(info.materials) ? info.materials.map(String).join(", ") : "",
      features: Array.isArray(info.features) ? info.features.map(String).join(", ") : "",
      website: specs.website ?? "",
      notes: typeof info.additionalNotes === "string" ? info.additionalNotes : "",
    };
  }

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }
}

export const productSetupEngine = new ProductSetupEngine();
