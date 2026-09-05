/**
 * STEP 2 engine — consumes STEP 1 output and persists AuthoritativeMarketingBrief.
 * Reuses marketing-brief API and canonical product; no duplicate storage.
 * STEP 2A — brand identity (name, website, phone, CTA, logo) is project-authoritative.
 */

import { fetchMediaIntelligence, formatMediaStatusLabel, prepareMediaIntelligence } from "../media-intelligence/api";
import type { VideoPlatformId } from "../../ai/video-production/platform-profiles.js";
import { VIDEO_PLATFORM_PROFILES } from "../../ai/video-production/platform-profiles.js";
import { normalizeWebsiteUrl } from "../../ai/creative-workspace/brand-identity.js";
import type { ProductImageSet } from "../image-organization/types";
import type { Step2HandoffPayload } from "../product-setup/types";
import {
  persistWorkflowStep,
  readProductImageSetFromProject,
  resolveBoundProject,
  writeScopedHandoff,
} from "../product-creation/workflow";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import {
  analyzeMarketingBrief,
  fetchCanonicalProduct,
  fetchMarketingBrief,
  finalizeMarketingBrief,
  persistMarketingBrief,
  readScopedHandoff,
  SETUP_HANDOFF_KEY,
  updateProjectApi,
} from "./api";
import {
  durationToSeconds,
  parseDurationFromBrief,
  platformLabelForBrief,
  platformPreview,
  resolvePlatformId,
} from "./platform-map";
import { calculateDiscount, computeReadiness } from "./readiness";
import type {
  BrandLogoState,
  CampaignObjectiveOption,
  CommercialFields,
  DurationOption,
  IntelligenceSummary,
  ProductSummary,
  ProjectAudioState,
  AudioLibraryItem,
  SaveState,
  SellingPointEntry,
  Step3HandoffPayload,
  VideoRequirementsSnapshot,
} from "./types";
import { STEP3_HANDOFF_KEY } from "./types";

type Listener = (snap: VideoRequirementsSnapshot) => void;
type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
) => void;

const OBJECTIVES: CampaignObjectiveOption[] = [
  "Product Showcase",
  "Promote Sale",
  "New Product",
  "Brand Awareness",
  "Drive Orders",
];

const CTA_OPTIONS = ["Shop Now", "Order Now", "Learn More", "Contact Us", "Visit Website", "Get Yours"];

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function emptyLogo(): BrandLogoState {
  return { assetId: null, url: null, fileName: null, status: "idle", error: null };
}

function emptyAudio(): ProjectAudioState {
  return {
    selected: null,
    library: [],
    libraryFilter: "ALL",
    libraryQuery: "",
    libraryOpen: false,
    uploadStatus: "idle",
    extractStatus: "idle",
    error: null,
    playingAssetId: null,
  };
}

function mapAudioItem(raw: Record<string, unknown>): AudioLibraryItem {
  return {
    assetId: String(raw.assetId ?? ""),
    title: String(raw.title ?? raw.originalFilename ?? "Audio"),
    originalFilename: String(raw.originalFilename ?? ""),
    sourceType: (raw.sourceType as AudioLibraryItem["sourceType"]) ?? "UPLOADED_AUDIO",
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : 0,
    playbackUrl: String(raw.playbackUrl ?? ""),
    status: String(raw.status ?? "READY"),
    createdAt: String(raw.createdAt ?? ""),
    mimeType: String(raw.mimeType ?? "audio/mpeg"),
  };
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export class VideoRequirementsEngine {
  private projectId: string | null = null;
  private projectName = "";
  private briefId: string | null = null;
  private product: ProductSummary | null = null;
  private productImageSet: ProductImageSet | null = null;
  private assetIds: string[] = [];
  private commercial: CommercialFields = {
    productName: "",
    currentPrice: null,
    previousPrice: null,
    currency: "RWF",
    brandName: "",
    website: "",
    contact: "",
  };
  private brandLogo: BrandLogoState = emptyLogo();
  private audio: ProjectAudioState = emptyAudio();
  private platformId: VideoPlatformId = "tiktok";
  private previewAudioEl: HTMLAudioElement | null = null;
  private duration: DurationOption = "30s";
  private customDurationSeconds: number | null = null;
  private objective: CampaignObjectiveOption = "Product Showcase";
  private language = "English";
  private cta = "";
  private sellingPoints: SellingPointEntry[] = [];
  private intelligence: IntelligenceSummary | null = null;
  private mediaPreparation: VideoRequirementsSnapshot["mediaPreparation"] = null;
  private saveState: SaveState = "saved";
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistGeneration = 0;
  private transitioning = false;
  private analyzed = false;

  setNotify(fn: NotifyFn | null): void {
    this.notify = fn;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): VideoRequirementsSnapshot {
    const discount = calculateDiscount(this.commercial.previousPrice, this.commercial.currentPrice);
    const base: VideoRequirementsSnapshot = {
      version: 1,
      projectId: this.projectId,
      projectName: this.projectName,
      briefId: this.briefId,
      product: this.product,
      commercial: { ...this.commercial },
      brandLogo: { ...this.brandLogo },
      audio: {
        ...this.audio,
        selected: this.audio.selected ? { ...this.audio.selected } : null,
        library: this.audio.library.map((a) => ({ ...a })),
      },
      discount,
      platformId: this.platformId,
      platformPreview: platformPreview(this.platformId),
      duration: this.duration,
      customDurationSeconds: this.customDurationSeconds,
      objective: this.objective,
      language: this.language,
      cta: this.cta,
      sellingPoints: [...this.sellingPoints],
      intelligence: this.intelligence,
      mediaPreparation: this.mediaPreparation,
      productImageSet: this.productImageSet,
      assetIds: [...this.assetIds],
      saveState: this.saveState,
      readiness: { ready: false, blockingIssues: [], warnings: [], statusLabel: "NOT READY" },
      canContinue: false,
      continueBlockedReason: null,
      updatedAt: new Date().toISOString(),
    };
    base.readiness = computeReadiness(base);
    base.canContinue = base.readiness.ready && !this.transitioning;
    base.continueBlockedReason = base.readiness.blockingIssues[0] ?? null;
    return base;
  }

  async hydrate(): Promise<void> {
    const step1Handoff = readScopedHandoff<Step2HandoffPayload>(SETUP_HANDOFF_KEY);
    const bound = await resolveBoundProject({ handoffProjectId: step1Handoff?.projectId });
    if (!bound) {
      this.emit();
      return;
    }
    const active = bound.project;
    this.projectId = bound.projectId;
    this.projectName = bound.projectName;

    const handoff = readScopedHandoff<Step2HandoffPayload>(SETUP_HANDOFF_KEY, bound.projectId);
    const imageSet = (readProductImageSetFromProject(active) ?? handoff?.productImageSet ?? null) as ProductImageSet | null;
    this.productImageSet = imageSet;

    const info = active.productInformation ?? {};
    const brand = active.brandInformation ?? { name: "" };
    const specs = (info.specifications ?? {}) as Record<string, string>;
    this.commercial = {
      productName: String(info.name ?? handoff?.essentials.productName ?? ""),
      currentPrice: typeof info.price === "number" ? info.price : handoff?.essentials.currentPrice ?? null,
      previousPrice: typeof info.originalPrice === "number" ? info.originalPrice : handoff?.essentials.previousPrice ?? null,
      currency: String(info.currency ?? handoff?.essentials.currency ?? "RWF"),
      brandName: String(brand.name || info.brand || ""),
      website: String(brand.website || info.website || specs.website || handoff?.optional?.website || ""),
      contact: String(brand.phone || info.phone || info.contact || ""),
    };

    const logoId = brand.logoAssetId?.trim() || "";
    const logoAsset = logoId ? active.productImages.find((img) => img.id === logoId) : null;
    this.brandLogo = logoAsset
      ? {
        assetId: logoAsset.id,
        url: logoAsset.url,
        fileName: logoAsset.fileName,
        status: "ready",
        error: null,
      }
      : emptyLogo();

    await this.refreshAudioLibrary();
    const selectedId = typeof active.selectedAudioAssetId === "string"
      ? active.selectedAudioAssetId
      : null;
    if (selectedId) {
      const fromLib = this.audio.library.find((a) => a.assetId === selectedId) ?? null;
      this.audio.selected = fromLib;
    } else {
      this.audio.selected = null;
    }

    const canonical = await fetchCanonicalProduct(active.id);
    const heroId = imageSet?.images.find((i) => i.roleInGroup === "primary")?.assetId
      ?? imageSet?.images[0]?.assetId
      ?? canonical?.originalAssetIds[0]
      ?? null;

    this.assetIds = canonical?.originalAssetIds.length
      ? canonical.originalAssetIds
      : (imageSet?.images.map((i) => i.assetId) ?? active.productImages
        .filter((img) => img.assetRole !== "brand-logo" && img.assetType !== "document")
        .map((i) => i.id));

    this.product = {
      productId: canonical?.productId ?? active.id,
      name: this.commercial.productName || canonical?.identity.name || active.name,
      category: canonical?.identity.category || handoff?.category || imageSet?.categoryEstimate || "Product",
      imageCount: this.assetIds.length,
      heroAssetId: heroId,
      heroUrl: heroId ? `/api/workspace/projects/${active.id}/images/${heroId}` : null,
      statusLabel: `${this.assetIds.length} original product photo${this.assetIds.length === 1 ? "" : "s"} ready`,
    };

    if (!this.commercial.productName && this.product.name) {
      this.commercial.productName = this.product.name;
    }

    this.buildIntelligenceSummary(canonical, imageSet);

    const mediaReport = await fetchMediaIntelligence(active.id)
      ?? await prepareMediaIntelligence(active.id);
    if (mediaReport?.summary) {
      this.mediaPreparation = {
        statusLabel: formatMediaStatusLabel(mediaReport.summary),
        ready: mediaReport.summary.ready,
        total: mediaReport.summary.total,
        needsReview: mediaReport.summary.needsReview + mediaReport.summary.lowQuality,
        productAnalysisReady: mediaReport.summary.productAnalysisReady,
      };
    }

    const brief = await fetchMarketingBrief(active.id);
    if (brief) {
      this.briefId = brief.briefId;
      this.platformId = resolvePlatformId(
        String(brief.userDefined?.videoPlatformId ?? brief.campaign.platforms[0] ?? this.platformId),
      );
      const parsed = parseDurationFromBrief(brief.output.duration || "30s");
      this.duration = parsed.duration;
      this.customDurationSeconds = parsed.custom;
      this.objective = this.objectiveFromBrief(brief.campaign.objective);
      this.language = brief.campaign.language || active.language || "English";
      this.cta = brief.campaign.cta || active.campaignInformation?.callToAction || "";
      this.loadSellingPointsFromBrief(brief.userDefined ?? {});
      const commercial = (brief.userDefined?.commercial ?? {}) as Record<string, unknown>;
      if (commercial.productName) this.commercial.productName = String(commercial.productName);
      if (typeof commercial.currentPrice === "number") this.commercial.currentPrice = commercial.currentPrice;
      if (typeof commercial.previousPrice === "number") this.commercial.previousPrice = commercial.previousPrice;
      if (commercial.currency) this.commercial.currency = String(commercial.currency);
      if (commercial.brandName) this.commercial.brandName = String(commercial.brandName);
      if (commercial.website) this.commercial.website = String(commercial.website);
      if (commercial.contact) this.commercial.contact = String(commercial.contact);
    } else if (active.platform) {
      this.platformId = resolvePlatformId(active.platform);
    }

    if (!this.cta && active.campaignInformation?.callToAction) {
      this.cta = active.campaignInformation.callToAction;
    }

    if (!this.analyzed && !brief?.intelligence) {
      void this.ensureIntelligence();
    } else if (this.sellingPoints.length === 0) {
      this.seedSellingPoints(canonical, brief);
    }

    this.emit();
  }

  private seedSellingPoints(
    canonical: Awaited<ReturnType<typeof fetchCanonicalProduct>>,
    brief: Awaited<ReturnType<typeof fetchMarketingBrief>>,
  ): void {
    const points: SellingPointEntry[] = [];
    for (const text of canonical?.sellingPoints ?? []) {
      if (text.trim()) {
        points.push({
          id: uid("sp"),
          text: String(text),
          source: "CONFIRMED",
          confidence: 1,
          status: "confirmed",
        });
      }
    }
    for (const rec of brief?.recommendations ?? []) {
      if (rec.status !== "PENDING") continue;
      const val = Array.isArray(rec.value) ? rec.value.join(", ") : String(rec.value ?? "");
      if (!val.trim()) continue;
      points.push({
        id: rec.id,
        text: val,
        source: rec.source === "CONFIRMED" ? "CONFIRMED" : "AI_INFERRED",
        confidence: rec.confidence,
        status: "suggested",
      });
    }
    if (points.length) this.sellingPoints = points.slice(0, 8);
  }

  private async ensureIntelligence(): Promise<void> {
    if (!this.projectId || this.analyzed) return;
    this.analyzed = true;
    try {
      await analyzeMarketingBrief(this.projectId);
      const brief = await fetchMarketingBrief(this.projectId);
      if (brief?.userDefined) this.loadSellingPointsFromBrief(brief.userDefined);
    } catch {
      /* optional intelligence */
    }
  }

  private buildIntelligenceSummary(
    canonical: Awaited<ReturnType<typeof fetchCanonicalProduct>>,
    imageSet: ProductImageSet | null,
  ): void {
    const viewsDetected: string[] = [];
    const viewsMissing: string[] = [];
    const lines: string[] = [];

    if (this.assetIds.length) {
      lines.push(`${this.assetIds.length} original product photo${this.assetIds.length === 1 ? "" : "s"}`);
    }

    const map = canonical?.assetMap ?? {};
    const viewLabels: Record<string, string> = {
      front: "Front", back: "Back", left: "Left side", right: "Right side",
      top: "Top", bottom: "Sole", detail: "Detail", packaging: "Packaging",
      side: "Side views", details: "Detail shots",
    };
    for (const [key, ids] of Object.entries(map)) {
      if (Array.isArray(ids) && ids.length) viewsDetected.push(viewLabels[key] ?? key);
    }

    if (imageSet?.images.length) {
      const corrected = imageSet.images.filter((i) => i.userCorrected).length;
      if (corrected) lines.push("User corrections preserved");
      for (const missing of imageSet.missingViews.slice(0, 4)) {
        viewsMissing.push(String(missing).replace(/_/g, " "));
      }
    }

    if (viewsDetected.length) lines.push(`${viewsDetected.join(", ")} detected`);
    this.intelligence = { lines, viewsDetected, viewsMissing };
  }

  private loadSellingPointsFromBrief(userDefined: Record<string, unknown>): void {
    const raw = userDefined.sellingPoints;
    if (!Array.isArray(raw)) return;
    this.sellingPoints = raw.map((entry) => {
      const e = entry as Record<string, unknown>;
      return {
        id: String(e.id ?? uid("sp")),
        text: String(e.text ?? ""),
        source: (e.source as SellingPointEntry["source"]) ?? "AI_INFERRED",
        confidence: typeof e.confidence === "number" ? e.confidence : 0.5,
        status: (e.status as SellingPointEntry["status"]) ?? "suggested",
      };
    }).filter((s) => s.text.trim());
  }

  private objectiveFromBrief(value: string): CampaignObjectiveOption {
    const match = OBJECTIVES.find((o) => o.toLowerCase() === value.trim().toLowerCase());
    return match ?? "Product Showcase";
  }

  setCommercialField<K extends keyof CommercialFields>(field: K, value: CommercialFields[K]): void {
    this.commercial[field] = value;
    this.schedulePersist();
    this.emit();
  }

  setPlatform(id: VideoPlatformId): void {
    this.platformId = id;
    void this.flushPersist();
    this.emit();
  }

  setDuration(duration: DurationOption, customSeconds?: number | null): void {
    this.duration = duration;
    if (duration === "custom") this.customDurationSeconds = customSeconds ?? this.customDurationSeconds;
    this.schedulePersist();
    this.emit();
  }

  setObjective(objective: CampaignObjectiveOption): void {
    this.objective = objective;
    this.schedulePersist();
    this.emit();
  }

  setLanguage(language: string): void {
    this.language = language;
    this.schedulePersist();
    this.emit();
  }

  setCta(cta: string): void {
    this.cta = cta;
    this.schedulePersist();
    this.emit();
  }

  addSellingPoint(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.sellingPoints.push({
      id: uid("sp"),
      text: trimmed,
      source: "USER_CONFIRMED",
      confidence: 1,
      status: "confirmed",
    });
    this.schedulePersist();
    this.emit();
  }

  confirmSellingPoint(id: string): void {
    this.sellingPoints = this.sellingPoints.map((s) =>
      s.id === id ? { ...s, status: "confirmed", source: "USER_CONFIRMED", confidence: 1 } : s,
    );
    this.schedulePersist();
    this.emit();
  }

  removeSellingPoint(id: string): void {
    this.sellingPoints = this.sellingPoints.filter((s) => s.id !== id);
    this.schedulePersist();
    this.emit();
  }

  async uploadBrandLogo(file: File): Promise<void> {
    if (!this.projectId) throw new Error("No project open");
    const localUrl = URL.createObjectURL(file);
    this.brandLogo = {
      assetId: null,
      url: localUrl,
      fileName: file.name,
      status: "uploading",
      error: null,
    };
    this.emit();
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
      const dataBase64 = btoa(binary);
      const res = await fetch(`/api/workspace/projects/${this.projectId}/images`, {
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
      if (!res.ok) throw new Error(body.error ?? `Logo upload failed (${res.status})`);
      const logo = body.logo ?? body.image;
      if (!logo?.id) throw new Error("Logo upload returned no asset id");
      URL.revokeObjectURL(localUrl);
      this.brandLogo = {
        assetId: logo.id,
        url: logo.url,
        fileName: logo.fileName,
        status: "ready",
        error: null,
      };
      this.saveState = "saved";
      workspaceStateEngine.autoSave.markDirty();
      this.emit();
    } catch (error) {
      this.brandLogo = {
        ...this.brandLogo,
        status: "error",
        error: error instanceof Error ? error.message : "Logo upload failed",
      };
      this.emit();
      throw error;
    }
  }

  async removeBrandLogo(): Promise<void> {
    if (!this.projectId) return;
    const res = await fetch(`/api/workspace/projects/${this.projectId}/brand-logo`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Unable to remove logo");
    }
    if (this.brandLogo.url?.startsWith("blob:")) URL.revokeObjectURL(this.brandLogo.url);
    this.brandLogo = emptyLogo();
    this.saveState = "saved";
    this.emit();
  }

  async refreshAudioLibrary(): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (this.audio.libraryFilter !== "ALL") params.set("sourceType", this.audio.libraryFilter);
      if (this.audio.libraryQuery.trim()) params.set("q", this.audio.libraryQuery.trim());
      const res = await fetch(`/api/workspace/audio-library?${params.toString()}`);
      const body = await res.json() as { assets?: Record<string, unknown>[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to load audio library");
      this.audio.library = (body.assets ?? []).map(mapAudioItem);
      if (this.audio.selected) {
        const refreshed = this.audio.library.find((a) => a.assetId === this.audio.selected!.assetId);
        if (refreshed) this.audio.selected = refreshed;
      }
      this.emit();
    } catch (error) {
      this.audio.error = error instanceof Error ? error.message : "Library load failed";
      this.emit();
    }
  }

  setAudioLibraryFilter(filter: ProjectAudioState["libraryFilter"]): void {
    this.audio.libraryFilter = filter;
    void this.refreshAudioLibrary();
  }

  setAudioLibraryQuery(query: string): void {
    this.audio.libraryQuery = query;
    void this.refreshAudioLibrary();
  }

  setAudioLibraryOpen(open: boolean): void {
    this.audio.libraryOpen = open;
    if (open) void this.refreshAudioLibrary();
    this.emit();
  }

  async uploadAudio(file: File): Promise<void> {
    if (!this.projectId) throw new Error("No project open");
    this.audio.uploadStatus = "uploading";
    this.audio.error = null;
    this.emit();
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch(`/api/workspace/projects/${this.projectId}/audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "audio/mpeg",
          dataBase64,
        }),
      });
      const body = await res.json() as {
        error?: string;
        audio?: Record<string, unknown>;
        reused?: boolean;
      };
      if (!res.ok) throw new Error(body.error ?? "Audio upload failed. Retry.");
      if (!body.audio) throw new Error("Audio upload returned no asset");
      const item = mapAudioItem(body.audio);
      this.audio.uploadStatus = "ready";
      await this.refreshAudioLibrary();
      await this.selectAudio(item.assetId);
      this.notify?.(
        "success",
        body.reused ? "Audio reused" : "Audio ready",
        body.reused
          ? "Identical file already in library — selected existing asset."
          : `${item.title} is ready.`,
      );
    } catch (error) {
      this.audio.uploadStatus = "error";
      this.audio.error = error instanceof Error ? error.message : "Audio upload failed. Retry.";
      this.emit();
      throw error;
    }
  }

  async extractAudioFromVideo(file: File): Promise<void> {
    if (!this.projectId) throw new Error("No project open");
    this.audio.extractStatus = "extracting";
    this.audio.error = null;
    this.emit();
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch(`/api/workspace/projects/${this.projectId}/audio/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "video/mp4",
          dataBase64,
        }),
      });
      const body = await res.json() as { error?: string; audio?: Record<string, unknown> };
      if (!res.ok) throw new Error(body.error ?? "Audio extraction failed. Retry.");
      if (!body.audio) throw new Error("Extraction returned no audio asset");
      const item = mapAudioItem(body.audio);
      this.audio.extractStatus = "ready";
      await this.refreshAudioLibrary();
      await this.selectAudio(item.assetId);
      this.notify?.("success", "Audio extracted", `${item.title} saved to library.`);
    } catch (error) {
      this.audio.extractStatus = "error";
      this.audio.error = error instanceof Error ? error.message : "Audio extraction failed. Retry.";
      this.emit();
      throw error;
    }
  }

  async selectAudio(assetId: string): Promise<void> {
    if (!this.projectId) throw new Error("No project open");
    const res = await fetch(`/api/workspace/projects/${this.projectId}/audio/selection`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    const body = await res.json() as { error?: string; audio?: Record<string, unknown> };
    if (!res.ok) throw new Error(body.error ?? "Unable to select audio");
    this.audio.selected = body.audio ? mapAudioItem(body.audio) : null;
    this.audio.libraryOpen = false;
    this.saveState = "saved";
    workspaceStateEngine.autoSave.markDirty();
    this.emit();
  }

  /** Remove from current video only — keeps library asset. */
  async removeAudioFromVideo(): Promise<void> {
    if (!this.projectId) return;
    this.stopAudioPreview();
    const res = await fetch(`/api/workspace/projects/${this.projectId}/audio/selection`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Unable to remove audio");
    }
    this.audio.selected = null;
    this.saveState = "saved";
    this.emit();
  }

  async deleteAudioFromLibrary(assetId: string): Promise<void> {
    const res = await fetch("/api/workspace/audio-library", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    const body = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Unable to delete audio");
    if (this.audio.selected?.assetId === assetId) this.audio.selected = null;
    if (this.audio.playingAssetId === assetId) this.stopAudioPreview();
    await this.refreshAudioLibrary();
  }

  toggleAudioPreview(item: AudioLibraryItem): void {
    if (typeof Audio === "undefined") return;
    if (this.audio.playingAssetId === item.assetId) {
      this.stopAudioPreview();
      return;
    }
    this.stopAudioPreview();
    const el = new Audio(item.playbackUrl);
    this.previewAudioEl = el;
    this.audio.playingAssetId = item.assetId;
    this.emit();
    el.onended = () => {
      this.audio.playingAssetId = null;
      this.previewAudioEl = null;
      this.emit();
    };
    el.onerror = () => {
      this.audio.playingAssetId = null;
      this.previewAudioEl = null;
      this.audio.error = "Audio playback failed.";
      this.emit();
    };
    void el.play().catch(() => {
      this.audio.playingAssetId = null;
      this.previewAudioEl = null;
      this.audio.error = "Audio playback failed.";
      this.emit();
    });
  }

  stopAudioPreview(): void {
    if (this.previewAudioEl) {
      this.previewAudioEl.pause();
      this.previewAudioEl.src = "";
      this.previewAudioEl = null;
    }
    if (this.audio.playingAssetId) {
      this.audio.playingAssetId = null;
      this.emit();
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.saveState = "unsaved";
    const generation = ++this.persistGeneration;
    this.persistTimer = setTimeout(() => {
      void this.flushPersist(generation).catch(() => {
        this.saveState = "error";
        this.emit();
      });
    }, 700);
  }

  async flushPersist(expectedGeneration?: number): Promise<void> {
    if (!this.projectId) return;
    const generation = expectedGeneration ?? ++this.persistGeneration;
    this.saveState = "saving";
    this.emit();

    const discount = calculateDiscount(this.commercial.previousPrice, this.commercial.currentPrice);
    const profile = VIDEO_PLATFORM_PROFILES[this.platformId];
    const durationStr = this.duration === "custom"
      ? `${durationToSeconds("custom", this.customDurationSeconds)}s`
      : this.duration;
    const website = normalizeWebsiteUrl(this.commercial.website);
    const brandName = this.commercial.brandName.trim();
    const contact = this.commercial.contact.trim();

    await persistMarketingBrief(this.projectId, {
      campaign: {
        objective: this.objective,
        platforms: [platformLabelForBrief(this.platformId)],
        cta: this.cta,
        language: this.language,
        lockedFields: ["aspectRatio", "duration", "platforms"],
      },
      output: {
        aspectRatio: profile.aspectRatio,
        duration: durationStr,
        contentFormat: "SHORT_PRODUCT_VIDEO",
      },
      userDefined: {
        videoPlatformId: this.platformId,
        customDurationSeconds: this.customDurationSeconds,
        website: website || null,
        phone: contact || null,
        commercial: {
          productName: this.commercial.productName.trim(),
          currentPrice: this.commercial.currentPrice,
          previousPrice: this.commercial.previousPrice,
          discountPercentage: discount.valid ? discount.percent : null,
          currency: this.commercial.currency,
          brandName: brandName || null,
          website: website || null,
          contact: contact || null,
        },
        sellingPoints: this.sellingPoints,
      },
    });

    if (generation !== this.persistGeneration) return;

    await updateProjectApi(this.projectId, {
      name: this.projectName,
      platform: this.platformId,
      language: this.language,
      selectedAudioAssetId: this.audio.selected?.assetId ?? null,
      audioEnabled: Boolean(this.audio.selected?.assetId),
      brandInformation: {
        name: brandName,
        website: website || undefined,
        phone: contact || undefined,
        logoAssetId: this.brandLogo.assetId || undefined,
      },
      productInformation: {
        name: this.commercial.productName.trim(),
        price: this.commercial.currentPrice ?? undefined,
        originalPrice: this.commercial.previousPrice ?? undefined,
        discount: discount.valid ? discount.percent ?? undefined : undefined,
        currency: this.commercial.currency,
        website: website || undefined,
        phone: contact || undefined,
        contact: contact || undefined,
        callToAction: this.cta || undefined,
        specifications: {
          ...(website ? { website } : {}),
        },
      },
      campaignInformation: {
        name: this.projectName,
        objective: this.objective,
        callToAction: this.cta,
        duration: this.duration,
        customDurationSeconds: this.customDurationSeconds ?? undefined,
        platforms: [platformLabelForBrief(this.platformId)],
      },
    });

    if (generation !== this.persistGeneration) return;

    const brief = await fetchMarketingBrief(this.projectId);
    if (brief) this.briefId = brief.briefId;

    this.saveState = "saved";
    workspaceStateEngine.autoSave.markDirty();
    this.emit();
  }

  async continueToStep3(): Promise<Step3HandoffPayload> {
    const snap = this.snapshot();
    if (!snap.canContinue || !snap.projectId || !snap.product) {
      throw new Error(snap.continueBlockedReason ?? "Step 2 is not ready");
    }
    if (this.transitioning) throw new Error("Step transition already in progress.");
    this.transitioning = true;
    try {
      await this.flushPersist();
      await analyzeMarketingBrief(snap.projectId);
      const finalized = await finalizeMarketingBrief(snap.projectId);
      if (!finalized?.briefId) throw new Error("Unable to finalize marketing brief.");

      const handoff: Step3HandoffPayload = {
        version: 1,
        step: "step-3-video-style",
        projectId: snap.projectId,
        projectName: snap.projectName,
        briefId: finalized.briefId,
        productId: snap.product.productId,
        assetIds: snap.assetIds,
        platformId: snap.platformId,
        durationSeconds: durationToSeconds(snap.duration, snap.customDurationSeconds),
        objective: snap.objective,
        language: snap.language,
        preparedAt: new Date().toISOString(),
      };
      writeScopedHandoff(STEP3_HANDOFF_KEY, handoff);
      await persistWorkflowStep(snap.projectId, 3, 2);
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      console.info("[STEP_2_COMPLETED]", { projectId: snap.projectId, briefId: finalized.briefId });
      this.emit();
      return handoff;
    } finally {
      this.transitioning = false;
    }
  }

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }
}

export const videoRequirementsEngine = new VideoRequirementsEngine();

export { CTA_OPTIONS, OBJECTIVES };
