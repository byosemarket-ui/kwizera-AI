import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { ProjectState } from "../state-manager/types.js";
import {
  extractAudioFromVideo,
  FfmpegAudioError,
  probeAudio,
} from "../video-production/ffmpeg-renderer.js";
import {
  audioExtensionForMime,
  audioUserError,
  extractedAudioTitle,
  isSafeAudioStorageFileName,
  maxAudioBytes,
  normalizeAudioMime,
  normalizeProjectAudio,
  sanitizeAudioFileName,
  type AudioAsset,
  type AudioSourceType,
  type ProjectAudioSelection,
} from "./audio-asset.js";
import { inspectImageBuffer } from "./image-inspect.js";
import {
  CreativeWorkspaceError,
  classifyAssetBucket,
  isOriginalProductImage,
  isSafeProjectId,
  listOriginalProductImages,
  type AssetAnalysisState,
  type AssetOrigin,
  type AssetProcessingStatus,
  type AssetRole,
  type DerivedImageKind,
  type ProjectAssetRef,
  type ProjectAssetType,
  type ProjectFoundationLinks,
} from "./project-asset.js";
export {
  CreativeWorkspaceError,
  classifyAssetBucket,
  isOriginalProductImage,
  isSafeProjectId,
  listOriginalProductImages,
} from "./project-asset.js";
export type {
  AssetAnalysisState,
  AssetOrigin,
  AssetProcessingStatus,
  AssetRole,
  DerivedImageKind,
  ProjectAssetRef,
  ProjectAssetType,
  ProjectFoundationLinks,
} from "./project-asset.js";
export type { AudioAsset, ProjectAudioSelection } from "./audio-asset.js";

export interface ProductVariant {
  id: string;
  kind: "color" | "size" | "model" | "package" | "other";
  label: string;
  values: string[];
}

export interface ProductInformation {
  name: string;
  category: string;
  description: string;
  sku?: string;
  brand?: string;
  price?: number;
  currency?: string;
  features?: string[];
  specifications?: Record<string, string>;
  colors?: string[];
  sizes?: string[];
  materials?: string[];
  tags?: string[];
  /** Step 3 Product Profile extensions — all optional for backward compatibility */
  model?: string;
  subcategory?: string;
  barcode?: string;
  shortDescription?: string;
  highlights?: string[];
  benefits?: string[];
  originalPrice?: number;
  discount?: number;
  costPrice?: number;
  promotionPrice?: number;
  priceNotes?: string;
  dimensions?: string;
  weight?: string;
  warranty?: string;
  stock?: string;
  countryOfOrigin?: string;
  additionalNotes?: string;
  /** STEP 2A — commercial contact fields (optional; prefer brandInformation for website/phone) */
  website?: string;
  phone?: string;
  contact?: string;
  email?: string;
  callToAction?: string;
  cta?: string;
}

export interface BrandInformation {
  name: string;
  website?: string;
  /** STEP 2A — contact phone for end card / overlays */
  phone?: string;
  whatsapp?: string;
  voice?: string;
  guidelines?: string;
  /** Step 4 project-specific brand prefs — do not replace global brand DB */
  style?: string;
  colors?: string;
  logoAssetId?: string;
}

export interface CampaignInformation {
  name: string;
  objective: string;
  callToAction?: string;
  notes?: string;
  /** Step 4 Marketing Input extensions */
  contentFormat?: string;
  duration?: string;
  customDurationSeconds?: number;
  platforms?: string[];
  promotionType?: string;
  promotionDetails?: string;
  tone?: string;
  style?: string;
  mood?: string;
  energy?: string;
}

export interface ProductImage {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  url: string;
  /** Optional client/server enrichment — never required for legacy projects */
  width?: number;
  height?: number;
  checksumSha256?: string;
  sourceFileName?: string;
  /** STEP 5 additive fields — absent on pre-STEP-5 project.json records */
  projectId?: string;
  assetType?: ProjectAssetType;
  origin?: AssetOrigin;
  processingStatus?: AssetProcessingStatus;
  parentAssetId?: string;
  analysisState?: AssetAnalysisState;
  derivedKind?: DerivedImageKind;
  assetRole?: AssetRole;
  /** Present on registered video outputs — never used as a product photograph. */
  durationMs?: number;
}

export interface CreativeProject {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  productImages: ProductImage[];
  productInformation: ProductInformation;
  brandInformation: BrandInformation;
  campaignInformation: CampaignInformation;
  targetAudience: string;
  language: string;
  platform: string;
  workspaceSettings: Record<string, unknown>;
  /** STEP 5 — Memory/Knowledge links. Optional so legacy projects still load. */
  description?: string;
  status?: "open" | "closed";
  foundation?: ProjectFoundationLinks;
  /**
   * STEP 2B — project selection only (does not store audio bytes).
   * Library assets live in the studio audio-library; projects reference by id.
   */
  selectedAudioAssetId?: string | null;
  audioEnabled?: boolean;
  audioVolume?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface UploadedImageInput {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  width?: number;
  height?: number;
  checksumSha256?: string;
  /**
   * When true, skip content-hash reuse (test fixtures / rare intentional copies).
   * Production Product Setup never sets this — duplicates are reused.
   */
  allowDuplicateContent?: boolean;
  assetType?: ProjectAssetType;
  origin?: AssetOrigin;
  parentAssetId?: string;
  derivedKind?: DerivedImageKind;
  analysisState?: AssetAnalysisState;
  assetRole?: AssetRole;
}

export type CreativeWorkspaceOrphanKind =
  | "project-dir-not-in-index"
  | "index-missing-project-dir"
  | "missing-project-json"
  | "asset-meta-missing-file"
  | "file-without-meta"
  | "temp-file";

export interface CreativeWorkspaceOrphan {
  kind: CreativeWorkspaceOrphanKind;
  projectId?: string;
  assetId?: string;
  detail: string;
}

export interface CreativeWorkspacePersistenceHealth {
  ok: boolean;
  checkedAt: string;
  storageRoot: string;
  creativeWorkspaceRoot: string;
  indexOk: boolean;
  writable: boolean;
  projectCount: number;
  projectsOk: number;
  projectsFailed: number;
  assetsOk: number;
  assetsMissingFile: number;
  workflowPresent: number;
  productPresent: number;
  marketingPresent: number;
  activeProjectId: string | null;
  orphanCount: number;
  orphans: CreativeWorkspaceOrphan[];
  issues: string[];
  note: string;
}

interface WorkspaceIndex {
  projectIds: string[];
  activeProjectId: string | null;
  updatedAt: string;
}

interface AudioLibraryIndex {
  version: 1;
  assets: AudioAsset[];
  updatedAt: string;
}

const EMPTY_PRODUCT: ProductInformation = { name: "", category: "", description: "" };
const EMPTY_BRAND: BrandInformation = { name: "" };
const EMPTY_CAMPAIGN: CampaignInformation = { name: "", objective: "" };

/** Step 1 intake formats — architecture ready for SVG/HEIC later (rejected with clear message until enabled). */
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "image/bmp",
  "image/x-ms-bmp",
]);
export const FUTURE_IMAGE_TYPES = new Set(["image/svg+xml", "image/heic", "image/heif"]);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
  "image/x-ms-bmp": "bmp",
  "video/mp4": "mp4",
};

/**
 * Creative Workspace Manager owns Step 1 project inputs only. It deliberately
 * has no generation, prompt, rendering, or export responsibilities.
 */
export class CreativeWorkspaceManager {
  private core: AiCoreManager | null = null;
  private root = "";
  private index: WorkspaceIndex = { projectIds: [], activeProjectId: null, updatedAt: "" };
  private projectLocks = new Map<string, Promise<unknown>>();

  private enqueueProject<T>(projectId: string, work: () => Promise<T>): Promise<T> {
    const prior = this.projectLocks.get(projectId) ?? Promise.resolve();
    const next = prior.then(work, work);
    this.projectLocks.set(projectId, next.then(() => undefined, () => undefined));
    return next;
  }

  async initialize(storageRoot: string, core?: AiCoreManager): Promise<void> {
    this.core = core ?? null;
    this.root = path.join(storageRoot, "creative-workspace");
    await fs.mkdir(path.join(this.root, "projects"), { recursive: true });
    await fs.mkdir(this.audioLibraryDir(), { recursive: true });
    this.index = await this.readJson<WorkspaceIndex>(this.indexPath(), {
      projectIds: [], activeProjectId: null, updatedAt: new Date().toISOString(),
    });
    await this.saveIndex();
    await this.ensureAudioLibraryIndex();
  }

  async createProject(name: string): Promise<CreativeProject> {
    this.ensureInitialized();
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Project name is required");

    const now = new Date().toISOString();
    const project: CreativeProject = {
      id: randomUUID(),
      name: trimmedName,
      createdAt: now,
      modifiedAt: now,
      productImages: [],
      productInformation: { ...EMPTY_PRODUCT },
      brandInformation: { ...EMPTY_BRAND },
      campaignInformation: { ...EMPTY_CAMPAIGN },
      targetAudience: "",
      language: "en",
      platform: "instagram",
      workspaceSettings: {},
      description: "",
      status: "open",
    };

    await fs.mkdir(this.projectPath(project.id), { recursive: true });
    this.index.projectIds.unshift(project.id);
    this.index.activeProjectId = project.id;
    await this.writeProjectRecord(project, true);
    return project;
  }

  async listProjects(): Promise<CreativeProject[]> {
    this.ensureInitialized();
    const projects = await Promise.all(this.index.projectIds.map((id) => this.getProject(id)));
    return projects.filter((project): project is CreativeProject => project !== null)
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  async getProject(projectId: string): Promise<CreativeProject | null> {
    this.ensureInitialized();
    if (!isSafeProjectId(projectId)) return null;
    const project = await this.readJson<CreativeProject | null>(this.projectFile(projectId), null);
    return project ? this.hydrateProject(project) : null;
  }

  async getActiveProject(): Promise<CreativeProject | null> {
    return this.index.activeProjectId ? this.getProject(this.index.activeProjectId) : null;
  }

  async openProject(projectId: string): Promise<CreativeProject> {
    return this.enqueueProject(projectId, async () => {
    const project = await this.requireProject(projectId);
    this.index.activeProjectId = project.id;
    project.status = "open";
    project.modifiedAt = new Date().toISOString();
    await this.writeProjectRecord(project);
    await this.saveIndex();
    this.transition(project.id, ProjectState.Open);
    return this.hydrateProject(project);
    });
  }

  async closeProject(projectId?: string): Promise<CreativeProject | null> {
    this.ensureInitialized();
    const target = projectId ?? this.index.activeProjectId;
    if (!target) return null;
    return this.enqueueProject(target, async () => {
    const project = await this.getProject(target);
    if (this.index.activeProjectId === target) {
      this.index.activeProjectId = null;
      await this.saveIndex();
    }
    if (!project) return null;
    project.status = "closed";
    project.modifiedAt = new Date().toISOString();
    await this.writeProjectRecord(project);
    return this.hydrateProject(project);
    });
  }

  async updateProject(projectId: string, changes: Partial<Omit<CreativeProject, "id" | "createdAt" | "modifiedAt" | "productImages">>): Promise<CreativeProject> {
    return this.enqueueProject(projectId, async () => {
      const project = await this.requireProject(projectId);
      const updated: CreativeProject = {
        ...project,
        ...changes,
        name: changes.name?.trim() ?? project.name,
        productInformation: { ...project.productInformation, ...changes.productInformation },
        brandInformation: { ...project.brandInformation, ...changes.brandInformation },
        campaignInformation: { ...project.campaignInformation, ...changes.campaignInformation },
        workspaceSettings: { ...project.workspaceSettings, ...changes.workspaceSettings },
        modifiedAt: new Date().toISOString(),
      };
      if ("selectedAudioAssetId" in changes) {
        updated.selectedAudioAssetId = changes.selectedAudioAssetId ?? null;
        if (!updated.selectedAudioAssetId) updated.audioEnabled = false;
      }
      if ("audioEnabled" in changes && typeof changes.audioEnabled === "boolean") {
        updated.audioEnabled = changes.audioEnabled;
      }
      if ("audioVolume" in changes && typeof changes.audioVolume === "number") {
        updated.audioVolume = Math.min(1, Math.max(0, changes.audioVolume));
      }
      await this.writeProjectRecord(updated);
      return this.hydrateProject(updated);
    });
  }

  async uploadImage(projectId: string, image: UploadedImageInput): Promise<ProductImage & { reused?: boolean }> {
    return this.enqueueProject(projectId, async () => this.uploadImageLocked(projectId, image));
  }

  /**
   * STEP 2A — upload brand logo (not a product photograph).
   * Stores as document + brand-logo role and sets brandInformation.logoAssetId.
   */
  async uploadBrandLogo(projectId: string, image: UploadedImageInput): Promise<{
    logo: ProductImage;
    project: CreativeProject;
  }> {
    return this.enqueueProject(projectId, async () => {
      const allowed = new Set(["image/png", "image/webp", "image/jpeg", "image/jpg"]);
      const mime = (image.mimeType || "").toLowerCase();
      if (!allowed.has(mime)) {
        throw new CreativeWorkspaceError(
          "UNSUPPORTED_FORMAT",
          "Brand logo must be PNG, WEBP, or JPEG",
        );
      }
      const uploaded = await this.uploadImageLocked(projectId, {
        ...image,
        assetType: "document",
        origin: "upload",
        assetRole: "brand-logo",
        analysisState: "not-applicable",
        allowDuplicateContent: true,
      });
      const project = await this.requireProject(projectId);
      project.brandInformation = {
        ...project.brandInformation,
        logoAssetId: uploaded.id,
      };
      project.modifiedAt = new Date().toISOString();
      await this.writeProjectRecord(project);
      return { logo: uploaded, project: this.hydrateProject(project) };
    });
  }

  async clearBrandLogo(projectId: string): Promise<CreativeProject> {
    return this.enqueueProject(projectId, async () => {
      const current = await this.requireProject(projectId);
      const nextBrand = { ...current.brandInformation };
      delete nextBrand.logoAssetId;
      current.brandInformation = nextBrand;
      current.modifiedAt = new Date().toISOString();
      await this.writeProjectRecord(current);
      return this.hydrateProject(current);
    });
  }

  // ─── STEP 2B — Audio Library (studio-scoped) + project selection ─────────

  async listAudioLibrary(filter?: {
    sourceType?: AudioSourceType | "ALL";
    query?: string;
  }): Promise<AudioAsset[]> {
    this.ensureInitialized();
    const index = await this.readAudioLibraryIndex();
    let assets = index.assets.filter((a) => a.status === "READY");
    if (filter?.sourceType && filter.sourceType !== "ALL") {
      assets = assets.filter((a) => a.sourceType === filter.sourceType);
    }
    const q = filter?.query?.trim().toLowerCase();
    if (q) {
      assets = assets.filter((a) =>
        a.title.toLowerCase().includes(q)
        || a.originalFilename.toLowerCase().includes(q)
        || a.sourceType.toLowerCase().includes(q),
      );
    }
    return assets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getAudioAsset(assetId: string): Promise<AudioAsset | null> {
    this.ensureInitialized();
    const index = await this.readAudioLibraryIndex();
    return index.assets.find((a) => a.assetId === assetId) ?? null;
  }

  async getAudioFilePath(assetId: string): Promise<string | null> {
    const asset = await this.getAudioAsset(assetId);
    if (!asset || asset.status !== "READY") return null;
    if (!isSafeAudioStorageFileName(asset.storageFileName)) return null;
    const filePath = path.join(this.audioLibraryDir(), asset.storageFileName);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  /** Resolve playback path by storage file name (for media serving). */
  async getAudioPathByFileName(fileName: string): Promise<string | null> {
    this.ensureInitialized();
    if (!isSafeAudioStorageFileName(fileName)) return null;
    const filePath = path.join(this.audioLibraryDir(), fileName);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  getProjectAudioSelection(project: CreativeProject): ProjectAudioSelection {
    return normalizeProjectAudio({
      selectedAudioAssetId: project.selectedAudioAssetId,
      enabled: project.audioEnabled,
      volume: project.audioVolume,
    });
  }

  async selectProjectAudio(projectId: string, assetId: string): Promise<{
    project: CreativeProject;
    audio: AudioAsset;
  }> {
    return this.enqueueProject(projectId, async () => {
      const asset = await this.getAudioAsset(assetId);
      if (!asset || asset.status !== "READY") {
        throw new CreativeWorkspaceError("ASSET_NOT_FOUND", audioUserError("ASSET_NOT_FOUND", "Audio asset not found."), 404);
      }
      const project = await this.requireProject(projectId);
      project.selectedAudioAssetId = asset.assetId;
      project.audioEnabled = true;
      if (typeof project.audioVolume !== "number") project.audioVolume = 1;
      project.modifiedAt = new Date().toISOString();
      await this.writeProjectRecord(project);
      console.info("[audio-library] project_select", {
        projectId,
        assetId: asset.assetId,
        sourceType: asset.sourceType,
        contentHash: asset.contentHash,
        durationMs: asset.durationMs,
      });
      return { project: this.hydrateProject(project), audio: asset };
    });
  }

  /** Clears project selection only — never deletes library asset. */
  async clearProjectAudio(projectId: string): Promise<CreativeProject> {
    return this.enqueueProject(projectId, async () => {
      const project = await this.requireProject(projectId);
      project.selectedAudioAssetId = null;
      project.audioEnabled = false;
      project.modifiedAt = new Date().toISOString();
      await this.writeProjectRecord(project);
      console.info("[audio-library] project_clear", { projectId });
      return this.hydrateProject(project);
    });
  }

  async uploadAudio(projectId: string, input: {
    fileName: string;
    mimeType: string;
    dataBase64: string;
  }): Promise<{ audio: AudioAsset; reused: boolean; project: CreativeProject }> {
    return this.enqueueProject(projectId, async () => {
      await this.requireProject(projectId);
      const started = Date.now();
      console.info("[audio-library] upload_start", {
        projectId,
        fileName: input.fileName,
        mimeType: input.mimeType,
      });

      const mime = normalizeAudioMime(input.mimeType, input.fileName);
      if (!mime) {
        throw new CreativeWorkspaceError("UNSUPPORTED_FORMAT", audioUserError("UNSUPPORTED_FORMAT", "Unsupported format"));
      }

      let data: Buffer;
      try {
        data = Buffer.from(input.dataBase64, "base64");
      } catch {
        throw new CreativeWorkspaceError("UPLOAD_FAILED", audioUserError("UPLOAD_FAILED", "Audio upload failed. Retry."));
      }
      if (!data.length) {
        throw new CreativeWorkspaceError("EMPTY_FILE", audioUserError("EMPTY_FILE", "Empty file"));
      }
      const limit = maxAudioBytes();
      if (data.length > limit) {
        throw new CreativeWorkspaceError("FILE_TOO_LARGE", audioUserError("FILE_TOO_LARGE", "Too large"));
      }

      const contentHash = createHash("sha256").update(data).digest("hex");
      const index = await this.readAudioLibraryIndex();
      const existing = index.assets.find(
        (a) => a.contentHash === contentHash && a.status === "READY",
      );
      if (existing) {
        const project = await this.requireProject(projectId);
        console.info("[audio-library] upload_reuse", {
          projectId,
          assetId: existing.assetId,
          contentHash,
          ms: Date.now() - started,
        });
        return { audio: existing, reused: true, project: this.hydrateProject(project) };
      }

      const assetId = randomUUID();
      const ext = audioExtensionForMime(mime);
      const storageFileName = `${assetId}.${ext}`;
      const safeName = sanitizeAudioFileName(input.fileName, ext);
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-audio-"));
      const tmpPath = path.join(tmpDir, `inspect.${ext}`);
      try {
        await fs.writeFile(tmpPath, data);
        let probed;
        try {
          probed = await probeAudio(tmpPath);
        } catch (error) {
          if (error instanceof FfmpegAudioError) {
            const code = error.code === "NO_AUDIO_STREAM" ? "NO_AUDIO_STREAM" : "CORRUPT_AUDIO";
            throw new CreativeWorkspaceError(code, audioUserError(code, error.message));
          }
          throw new CreativeWorkspaceError("CORRUPT_AUDIO", audioUserError("CORRUPT_AUDIO", "Decode failed"));
        }

        const finalMime = normalizeAudioMime(probed.mimeHint, safeName) ?? mime;
        const finalExt = audioExtensionForMime(finalMime);
        const finalStorage = finalExt === ext ? storageFileName : `${assetId}.${finalExt}`;
        await this.writeBinaryAtomic(path.join(this.audioLibraryDir(), finalStorage), data);

        const now = new Date().toISOString();
        const title = safeName.replace(/\.[^.]+$/, "") || safeName;
        const audio: AudioAsset = {
          assetId,
          type: "AUDIO",
          sourceType: "UPLOADED_AUDIO",
          originalFilename: safeName,
          title,
          mimeType: finalMime,
          durationMs: probed.durationMs,
          fileSize: data.length,
          storageFileName: finalStorage,
          playbackUrl: `/api/workspace/audio-library/${finalStorage}`,
          contentHash,
          status: "READY",
          metadata: {
            codec: probed.codec,
            sampleRate: probed.sampleRate,
            channels: probed.channels,
            bitrate: probed.bitrate,
            container: probed.container,
            bpm: null,
            tempo: null,
            energy: null,
            beats: null,
            sections: null,
            mood: null,
          },
          createdAt: now,
          updatedAt: now,
          ownerProjectId: projectId,
        };

        index.assets.push(audio);
        index.updatedAt = now;
        await this.writeAudioLibraryIndex(index);
        const project = await this.requireProject(projectId);
        console.info("[audio-library] upload_complete", {
          projectId,
          assetId,
          sourceType: audio.sourceType,
          contentHash,
          filename: safeName,
          status: audio.status,
          durationMs: audio.durationMs,
          ms: Date.now() - started,
        });
        return { audio, reused: false, project: this.hydrateProject(project) };
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
      }
    });
  }

  /**
   * Extract audio from an uploaded video (base64) without modifying any existing video asset.
   * Creates a new library AudioAsset (EXTRACTED_FROM_VIDEO).
   */
  async extractAudioFromUploadedVideo(projectId: string, input: {
    fileName: string;
    mimeType?: string;
    dataBase64: string;
  }): Promise<{ audio: AudioAsset; project: CreativeProject }> {
    return this.enqueueProject(projectId, async () => {
      await this.requireProject(projectId);
      const started = Date.now();
      console.info("[audio-library] extract_start", { projectId, fileName: input.fileName });

      let data: Buffer;
      try {
        data = Buffer.from(input.dataBase64, "base64");
      } catch {
        throw new CreativeWorkspaceError("EXTRACTION_FAILED", audioUserError("EXTRACTION_FAILED", "Failed"));
      }
      if (!data.length) {
        throw new CreativeWorkspaceError("EMPTY_FILE", "Video file is empty.");
      }
      if (data.length > 200 * 1024 * 1024) {
        throw new CreativeWorkspaceError("FILE_TOO_LARGE", "Video file is too large for audio extraction (max 200 MB).");
      }

      const safeVideoName = sanitizeAudioFileName(input.fileName, "mp4");
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-extract-"));
      const videoPath = path.join(tmpDir, `source${path.extname(safeVideoName) || ".mp4"}`);
      const outPath = path.join(tmpDir, "extracted.m4a");
      try {
        await fs.writeFile(videoPath, data);
        let probed;
        try {
          probed = await extractAudioFromVideo(videoPath, outPath);
        } catch (error) {
          if (error instanceof FfmpegAudioError) {
            const code = error.code === "NO_AUDIO_STREAM" ? "NO_AUDIO_STREAM" : "EXTRACTION_FAILED";
            throw new CreativeWorkspaceError(code, audioUserError(code, error.message));
          }
          throw new CreativeWorkspaceError("EXTRACTION_FAILED", audioUserError("EXTRACTION_FAILED", "Failed"));
        }

        const extractedBytes = await fs.readFile(outPath);
        if (!extractedBytes.length) {
          throw new CreativeWorkspaceError("EXTRACTION_FAILED", audioUserError("EXTRACTION_FAILED", "Failed"));
        }

        const contentHash = createHash("sha256").update(extractedBytes).digest("hex");
        const index = await this.readAudioLibraryIndex();
        const existing = index.assets.find(
          (a) => a.contentHash === contentHash && a.status === "READY",
        );
        if (existing) {
          const project = await this.requireProject(projectId);
          console.info("[audio-library] extract_reuse", {
            projectId,
            assetId: existing.assetId,
            contentHash,
            ms: Date.now() - started,
          });
          return { audio: existing, project: this.hydrateProject(project) };
        }

        const assetId = randomUUID();
        const mime = normalizeAudioMime(probed.mimeHint, "extracted.m4a") ?? "audio/mp4";
        const ext = audioExtensionForMime(mime);
        const storageFileName = `${assetId}.${ext}`;
        await this.writeBinaryAtomic(path.join(this.audioLibraryDir(), storageFileName), extractedBytes);

        const now = new Date().toISOString();
        const title = extractedAudioTitle(safeVideoName);
        const audio: AudioAsset = {
          assetId,
          type: "AUDIO",
          sourceType: "EXTRACTED_FROM_VIDEO",
          originalFilename: `${title}.${ext}`,
          title,
          mimeType: mime,
          durationMs: probed.durationMs,
          fileSize: extractedBytes.length,
          storageFileName,
          playbackUrl: `/api/workspace/audio-library/${storageFileName}`,
          contentHash,
          status: "READY",
          metadata: {
            codec: probed.codec,
            sampleRate: probed.sampleRate,
            channels: probed.channels,
            bitrate: probed.bitrate,
            container: probed.container,
            bpm: null,
            tempo: null,
            energy: null,
            beats: null,
            sections: null,
            mood: null,
          },
          createdAt: now,
          updatedAt: now,
          ownerProjectId: projectId,
          parentVideoFileName: safeVideoName,
        };

        index.assets.push(audio);
        index.updatedAt = now;
        await this.writeAudioLibraryIndex(index);
        const project = await this.requireProject(projectId);
        console.info("[audio-library] extract_complete", {
          projectId,
          assetId,
          sourceType: audio.sourceType,
          contentHash,
          durationMs: audio.durationMs,
          ms: Date.now() - started,
        });
        return { audio, project: this.hydrateProject(project) };
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
      }
    });
  }

  /**
   * Delete from library when no project still selects it.
   */
  async deleteAudioAsset(assetId: string): Promise<{ deleted: boolean }> {
    this.ensureInitialized();
    const asset = await this.getAudioAsset(assetId);
    if (!asset) {
      throw new CreativeWorkspaceError("ASSET_NOT_FOUND", audioUserError("ASSET_NOT_FOUND", "Not found"), 404);
    }

    const referencing: string[] = [];
    for (const projectId of this.index.projectIds) {
      const project = await this.getProject(projectId);
      if (project?.selectedAudioAssetId === assetId) {
        referencing.push(projectId);
      }
    }
    if (referencing.length) {
      throw new CreativeWorkspaceError(
        "ASSET_IN_USE",
        audioUserError("ASSET_IN_USE", "In use"),
        409,
      );
    }

    const index = await this.readAudioLibraryIndex();
    index.assets = index.assets.filter((a) => a.assetId !== assetId);
    index.updatedAt = new Date().toISOString();
    await this.writeAudioLibraryIndex(index);
    if (isSafeAudioStorageFileName(asset.storageFileName)) {
      await fs.rm(path.join(this.audioLibraryDir(), asset.storageFileName), { force: true }).catch(() => undefined);
    }
    console.info("[audio-library] delete", { assetId, contentHash: asset.contentHash });
    return { deleted: true };
  }

  private audioLibraryDir(): string {
    return path.join(this.root, "audio-library");
  }

  private audioLibraryIndexPath(): string {
    return path.join(this.audioLibraryDir(), "index.json");
  }

  private async ensureAudioLibraryIndex(): Promise<void> {
    await fs.mkdir(this.audioLibraryDir(), { recursive: true });
    const existing = await this.readJson<AudioLibraryIndex | null>(this.audioLibraryIndexPath(), null);
    if (!existing) {
      await this.writeAudioLibraryIndex({
        version: 1,
        assets: [],
        updatedAt: new Date().toISOString(),
      });
    }
  }

  private async readAudioLibraryIndex(): Promise<AudioLibraryIndex> {
    await this.ensureAudioLibraryIndex();
    const raw = await this.readJson<AudioLibraryIndex>(this.audioLibraryIndexPath(), {
      version: 1,
      assets: [],
      updatedAt: new Date().toISOString(),
    });
    return {
      version: 1,
      assets: Array.isArray(raw.assets) ? raw.assets : [],
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  }

  private async writeAudioLibraryIndex(index: AudioLibraryIndex): Promise<void> {
    await this.writeJson(this.audioLibraryIndexPath(), index);
  }

  /**
   * Must only run inside enqueueProject for projectId.
   * Re-reads the project so concurrent mutations never clobber productImages.
   * Same content SHA-256 in the same project reuses the existing original (idempotent).
   */
  private async uploadImageLocked(projectId: string, image: UploadedImageInput): Promise<ProductImage & { reused?: boolean }> {
    const project = await this.requireProject(projectId);
    if (FUTURE_IMAGE_TYPES.has(image.mimeType)) {
      throw new CreativeWorkspaceError("UNSUPPORTED_FORMAT", `Format ${image.mimeType} is reserved for a future release and is not enabled yet`);
    }
    if (!ALLOWED_IMAGE_TYPES.has(image.mimeType)) {
      throw new CreativeWorkspaceError("UNSUPPORTED_FORMAT", "Unsupported format. Supported: JPG, JPEG, PNG, WEBP, TIFF, BMP");
    }
    const data = Buffer.from(image.dataBase64, "base64");
    if (!data.length || data.length > MAX_IMAGE_BYTES) {
      throw new CreativeWorkspaceError("INVALID_IMAGE", "Product image must be between 1 byte and 25 MB");
    }
    const inspected = inspectImageBuffer(data, image.mimeType);
    if (!inspected.ok) {
      throw new CreativeWorkspaceError(inspected.code, inspected.message);
    }

    const checksumSha256 = createHash("sha256").update(data).digest("hex");
    const isDerived = image.origin === "derived"
      || image.assetType === "derived-image"
      || Boolean(image.parentAssetId);

    if (!isDerived && !image.allowDuplicateContent) {
      const existing = project.productImages.find((entry) =>
        entry.checksumSha256 === checksumSha256
        && isOriginalProductImage(entry),
      );
      if (existing) {
        return { ...existing, reused: true };
      }
    }

    const extension = EXT_BY_MIME[inspected.mimeType] ?? inspected.mimeType.split("/")[1]?.replace("x-ms-", "") ?? "bin";
    const id = randomUUID();
    const safeName = path.basename(image.fileName).replace(/[^a-zA-Z0-9._-]/g, "_") || `product.${extension}`;
    const storedName = `${id}.${extension}`;
    const imageDirectory = path.join(this.projectPath(projectId), "images");
    await fs.mkdir(imageDirectory, { recursive: true });
    // Project-owned copy only — never touch the user's original Windows path.
    // Atomic write: temp → rename (avoids half-written files on crash).
    await this.writeBinaryAtomic(path.join(imageDirectory, storedName), data);

    const uploaded: ProductImage = {
      id,
      fileName: safeName,
      mimeType: inspected.mimeType,
      sizeBytes: data.length,
      uploadedAt: new Date().toISOString(),
      url: `/api/workspace/projects/${projectId}/images/${storedName}`,
      width: inspected.width ?? image.width,
      height: inspected.height ?? image.height,
      checksumSha256,
      sourceFileName: image.fileName,
      projectId,
      assetType: image.assetType ?? "original-image",
      origin: image.origin ?? "upload",
      processingStatus: "ready",
      parentAssetId: image.parentAssetId,
      analysisState: image.analysisState
        ?? (image.parentAssetId || image.origin === "derived" ? "not-applicable" : "pending"),
      derivedKind: image.derivedKind,
      assetRole: image.assetRole ?? "unassigned",
    };
    project.productImages.push(uploaded);
    project.modifiedAt = uploaded.uploadedAt;
    await this.writeProjectRecord(project);
    return uploaded;
  }

  async removeImage(projectId: string, imageId: string): Promise<CreativeProject> {
    return this.enqueueProject(projectId, async () => {
    const project = await this.requireProject(projectId);
    const image = project.productImages.find((item) => item.id === imageId);
    if (!image) throw new CreativeWorkspaceError("ASSET_NOT_FOUND", "Image not found", 404);
    const toRemove = new Set<string>([imageId]);
    for (const child of project.productImages.filter((item) => item.parentAssetId === imageId)) {
      toRemove.add(child.id);
    }
    for (const id of toRemove) {
      const entry = project.productImages.find((item) => item.id === id);
      if (!entry) continue;
      const extension = EXT_BY_MIME[entry.mimeType] ?? entry.mimeType.split("/")[1] ?? "bin";
      const storedName = `${entry.id}.${extension}`;
      const filePath = path.join(this.projectPath(projectId), "images", storedName);
      try {
        await fs.unlink(filePath);
      } catch {
        /* file may already be missing — still drop metadata */
      }
    }
    project.productImages = project.productImages.filter((item) => !toRemove.has(item.id));
    project.modifiedAt = new Date().toISOString();
    await this.writeProjectRecord(project);
    return project;
    });
  }

  async getImagePath(projectId: string, imageFile: string): Promise<string | null> {
    if (!isSafeProjectId(projectId)) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imageFile)) {
      const project = await this.getProject(projectId);
      const image = project?.productImages.find((item) => item.id === imageFile);
      if (!image) return null;
      const extension = EXT_BY_MIME[image.mimeType] ?? image.mimeType.split("/")[1] ?? "png";
      return this.getImagePath(projectId, `${imageFile}.${extension}`);
    }
    if (!/^[a-f0-9-]+\.(jpe?g|png|webp|tiff?|bmp)$/i.test(imageFile)) return null;
    const project = await this.getProject(projectId);
    if (!project) return null;
    const imageId = imageFile.replace(/\.[^.]+$/, "");
    if (!project.productImages.some((item) => item.id === imageId)) return null;
    const filePath = path.join(this.projectPath(projectId), "images", imageFile);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  listOriginalImages(project: CreativeProject): ProductImage[] {
    return listOriginalProductImages(project.productImages);
  }

  /** Resolve the absolute path of an original uploaded product image. Never used for writes by asset prep. */
  async getOriginalImagePath(projectId: string, imageId: string): Promise<string | null> {
    const project = await this.getProject(projectId);
    const image = project?.productImages.find((item) => item.id === imageId);
    if (!image || !isOriginalProductImage(image) || classifyAssetBucket(image) !== "original") return null;
    return this.resolveStoredImagePath(projectId, image);
  }

  /**
   * Resolve any project image file path (product photos OR brand logos).
   * Does not invent assets — id must exist on the project.
   */
  async getAssetImagePath(projectId: string, imageId: string): Promise<string | null> {
    const project = await this.getProject(projectId);
    const image = project?.productImages.find((item) => item.id === imageId);
    if (!image) return null;
    if (image.assetType === "video" || image.assetType === "audio" || image.assetType === "rendered") return null;
    return this.resolveStoredImagePath(projectId, image);
  }

  private async resolveStoredImagePath(
    projectId: string,
    image: ProductImage,
  ): Promise<string | null> {
    const preferredExt = EXT_BY_MIME[image.mimeType] ?? (image.mimeType === "image/jpeg" ? "jpeg" : image.mimeType.split("/")[1]);
    if (!preferredExt || preferredExt === "mp4") return null;
    const preferredPath = await this.getImagePath(projectId, `${image.id}.${preferredExt}`);
    if (preferredPath) return preferredPath;
    const imageDir = path.join(this.projectPath(projectId), "images");
    try {
      const entries = await fs.readdir(imageDir);
      const match = entries.find((entry) => entry.startsWith(`${image.id}.`));
      if (!match) return null;
      return this.getImagePath(projectId, match);
    } catch {
      return null;
    }
  }

  async getVideoPath(projectId: string, videoFile: string): Promise<string | null> {
    if (!isSafeProjectId(projectId)) return null;
    if (!/^[a-f0-9-]+\.mp4$/i.test(videoFile)) return null;
    const project = await this.getProject(projectId);
    if (!project) return null;
    const videoId = videoFile.replace(/\.[^.]+$/, "");
    const asset = project.productImages.find((item) => item.id === videoId && (item.assetType === "video" || item.mimeType === "video/mp4"));
    if (!asset) return null;
    const filePath = path.join(this.projectPath(projectId), "videos", videoFile);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  /**
   * Register a rendered MP4 as a generated video asset. Does not inspect as an image
   * and never treats the file as an original product photograph.
   */
  async registerOutputAsset(projectId: string, input: {
    sourcePath: string;
    fileName: string;
    mimeType: "video/mp4";
    width: number;
    height: number;
    sizeBytes: number;
    durationMs: number;
    parentAssetId?: string;
    renderJobId?: string;
  }): Promise<ProductImage> {
    return this.enqueueProject(projectId, async () => {
    const project = await this.requireProject(projectId);
    if (!path.isAbsolute(input.sourcePath)) {
      throw new CreativeWorkspaceError("INVALID_IMAGE", "Video output path must be absolute", 400);
    }
    if (input.mimeType !== "video/mp4") {
      throw new CreativeWorkspaceError("UNSUPPORTED_FORMAT", "Video output must be video/mp4");
    }
    const data = await fs.readFile(input.sourcePath);
    if (!data.length || data.length < 100) {
      throw new CreativeWorkspaceError("INVALID_IMAGE", "Rendered video file is empty or unreadable");
    }
    const id = randomUUID();
    const storedName = `${id}.mp4`;
    const videoDirectory = path.join(this.projectPath(projectId), "videos");
    await fs.mkdir(videoDirectory, { recursive: true });
    await this.writeBinaryAtomic(path.join(videoDirectory, storedName), data);
    const checksumSha256 = createHash("sha256").update(data).digest("hex");
    const uploaded: ProductImage = {
      id,
      fileName: path.basename(input.fileName).replace(/[^a-zA-Z0-9._-]/g, "_") || "product-video.mp4",
      mimeType: "video/mp4",
      sizeBytes: data.length,
      uploadedAt: new Date().toISOString(),
      url: `/api/workspace/projects/${projectId}/videos/${storedName}`,
      width: input.width,
      height: input.height,
      durationMs: input.durationMs,
      checksumSha256,
      sourceFileName: input.renderJobId ? `render-${input.renderJobId}.mp4` : input.fileName,
      projectId,
      assetType: "video",
      origin: "generated",
      processingStatus: "ready",
      parentAssetId: input.parentAssetId,
      analysisState: "not-applicable",
      derivedKind: "generated",
      assetRole: "generated",
    };
    project.productImages.push(uploaded);
    project.modifiedAt = uploaded.uploadedAt;
    await this.writeProjectRecord(project);
    return uploaded;
    });
  }

  listProjectAssets(project: CreativeProject): ProjectAssetRef[] {
    return project.productImages.map((image) => this.toAssetRef(project.id, image));
  }

  getAsset(project: CreativeProject, assetId: string): ProjectAssetRef | null {
    const image = project.productImages.find((item) => item.id === assetId);
    return image ? this.toAssetRef(project.id, image) : null;
  }

  /**
   * Store a derived representation next to the original. Never overwrites the parent file.
   * Parent check + write share one project lock so uploads cannot race the parent lookup.
   */
  async registerDerivedAsset(projectId: string, input: UploadedImageInput & { parentAssetId: string; assetType?: ProjectAssetType }): Promise<ProductImage> {
    return this.enqueueProject(projectId, async () => {
      const project = await this.requireProject(projectId);
      if (!project.productImages.some((item) => item.id === input.parentAssetId)) {
        throw new CreativeWorkspaceError("ASSET_NOT_FOUND", "Parent asset not found", 404);
      }
      return this.uploadImageLocked(projectId, {
        ...input,
        assetType: input.assetType ?? "derived-image",
        origin: "derived",
        parentAssetId: input.parentAssetId,
        analysisState: "not-applicable",
        derivedKind: input.derivedKind ?? "preview",
      });
    });
  }

  /**
   * Update asset metadata only. Never rewrites original or derived image bytes.
   */
  async patchImage(
    projectId: string,
    imageId: string,
    patch: Partial<Pick<ProductImage, "processingStatus" | "analysisState" | "derivedKind" | "assetRole">>,
  ): Promise<ProductImage> {
    return this.enqueueProject(projectId, async () => {
    const project = await this.requireProject(projectId);
    const index = project.productImages.findIndex((item) => item.id === imageId);
    if (index < 0) throw new CreativeWorkspaceError("ASSET_NOT_FOUND", "Image not found", 404);
    const current = project.productImages[index]!;
    const updated: ProductImage = { ...current, ...patch };
    project.productImages[index] = updated;
    project.modifiedAt = new Date().toISOString();
    await this.writeProjectRecord(project);
    return this.normalizeImage(projectId, updated);
    });
  }

  private toAssetRef(projectId: string, image: ProductImage): ProjectAssetRef {
    const hydrated = this.normalizeImage(projectId, image);
    return {
      assetId: hydrated.id,
      projectId,
      assetType: hydrated.assetType ?? "original-image",
      originalFilename: hydrated.sourceFileName ?? hydrated.fileName,
      storageRef: hydrated.url,
      mimeType: hydrated.mimeType,
      sizeBytes: hydrated.sizeBytes,
      width: hydrated.width,
      height: hydrated.height,
      createdAt: hydrated.uploadedAt,
      processingStatus: hydrated.processingStatus ?? "ready",
      origin: hydrated.origin ?? "upload",
      parentAssetId: hydrated.parentAssetId,
      checksumSha256: hydrated.checksumSha256,
      analysisState: hydrated.analysisState,
      derivedKind: hydrated.derivedKind,
      assetRole: hydrated.assetRole,
      metadata: {
        analysisState: hydrated.analysisState ?? null,
        derivedKind: hydrated.derivedKind ?? null,
        assetRole: hydrated.assetRole ?? null,
        original: isOriginalProductImage(hydrated),
      },
    };
  }

  private hydrateProject(project: CreativeProject): CreativeProject {
    const active = this.index.activeProjectId === project.id;
    const audio = normalizeProjectAudio({
      selectedAudioAssetId: project.selectedAudioAssetId,
      enabled: project.audioEnabled,
      volume: project.audioVolume,
    });
    return {
      ...project,
      status: active ? "open" : (project.status ?? "closed"),
      selectedAudioAssetId: audio.selectedAudioAssetId,
      audioEnabled: audio.enabled,
      audioVolume: audio.volume,
      productImages: project.productImages.map((image) => this.normalizeImage(project.id, image)),
    };
  }

  private normalizeImage(projectId: string, image: ProductImage): ProductImage {
    return {
      ...image,
      projectId: image.projectId ?? projectId,
      assetType: image.assetType ?? "original-image",
      origin: image.origin ?? "upload",
      processingStatus: image.processingStatus ?? "ready",
      analysisState: image.analysisState
        ?? (image.parentAssetId || image.origin === "derived" ? "not-applicable" : "pending"),
      derivedKind: image.derivedKind,
      assetRole: image.assetRole ?? "unassigned",
      url: image.url || (image.assetType === "video" || image.mimeType === "video/mp4"
        ? `/api/workspace/projects/${projectId}/videos/${image.id}.mp4`
        : `/api/workspace/projects/${projectId}/images/${image.id}.${EXT_BY_MIME[image.mimeType] ?? "bin"}`),
    };
  }

  /** Full creative brief validation (later steps). */
  validate(project: CreativeProject | null): ValidationResult {
    const errors: string[] = [];
    if (!project) errors.push("Create or open a project before continuing.");
    if (!project) return { valid: false, errors };
    if (!project.name.trim()) errors.push("Project name is required.");
    if (!listOriginalProductImages(project.productImages).length) errors.push("Upload at least one product image.");
    if (!project.productInformation.name.trim()) errors.push("Product name is required.");
    if (!project.productInformation.category.trim()) errors.push("Product category is required.");
    if (!project.productInformation.description.trim()) errors.push("Product description is required.");
    if (!project.brandInformation.name.trim()) errors.push("Brand name is required.");
    if (!project.campaignInformation.name.trim()) errors.push("Campaign name is required.");
    if (!project.campaignInformation.objective.trim()) errors.push("Campaign objective is required.");
    if (!project.targetAudience.trim()) errors.push("Target audience is required.");
    if (!project.language.trim()) errors.push("Language is required.");
    if (!project.platform.trim()) errors.push("Platform is required.");
    return { valid: errors.length === 0, errors };
  }

  /** Step 1 Product Intake gate — project name + ≥1 stored image. Warnings do not block. */
  validateIntake(project: CreativeProject | null): ValidationResult {
    const errors: string[] = [];
    if (!project) errors.push("Create or open a project before continuing.");
    if (!project) return { valid: false, errors };
    if (!project.name.trim()) errors.push("Project name is required.");
    if (!listOriginalProductImages(project.productImages).length) errors.push("Import at least one valid product image.");
    return { valid: errors.length === 0, errors };
  }

  /** Step 3 Product Profile gate — name + price + images (category optional; AI may derive). */
  validateProductProfile(project: CreativeProject | null): ValidationResult {
    const errors: string[] = [];
    if (!project) errors.push("Create or open a project before continuing.");
    if (!project) return { valid: false, errors };
    if (!project.name.trim() && !project.productInformation.name.trim()) errors.push("Product name is required.");
    if (!project.productInformation.name.trim()) errors.push("Product name is required.");
    if (project.productInformation.price == null || !Number.isFinite(project.productInformation.price) || project.productInformation.price < 0) {
      errors.push("A valid selling price is required.");
    }
    if (!listOriginalProductImages(project.productImages).length) errors.push("At least one original product image is required.");
    return { valid: errors.length === 0, errors };
  }

  /** Fill empty production/marketing fields from Step 3/4 data — never overwrites user values. */
  async ensureProductProductionDefaults(projectId: string): Promise<CreativeProject> {
    this.ensureInitialized();
    const project = await this.getProject(projectId);
    if (!project) throw new Error("Project not found");
    const info = project.productInformation;
    const brief = project.workspaceSettings?.marketingInputBrief as {
      fields?: {
        objective?: string;
        audienceType?: string;
        audienceNotes?: string;
        customerSegment?: string;
        platforms?: string[];
        contentFormat?: string;
        customFormat?: string;
        language?: string;
        languageOther?: string;
        cta?: string;
        ctaCustom?: string;
        tone?: string;
        style?: string;
      };
    } | undefined;
    const bf = brief?.fields;
    const audienceFromBrief = [bf?.audienceType, bf?.customerSegment, bf?.audienceNotes].filter(Boolean).join(" · ");
    const platformFromBrief = bf?.platforms?.[0];
    const formatFromBrief = bf?.contentFormat === "Custom Format" ? bf?.customFormat : bf?.contentFormat;
    const langFromBrief = bf?.language === "Other" ? bf?.languageOther : bf?.language;
    const ctaFromBrief = bf?.cta === "Custom CTA" ? bf?.ctaCustom : bf?.cta;
    const brand = project.brandInformation?.name?.trim() || info.brand?.trim() || info.name.trim();
    const description = info.description?.trim() || info.shortDescription?.trim() || `${info.name} product showcase`;
    const category = info.category?.trim() || "General product";
    const patch: Partial<CreativeProject> = {
      productInformation: {
        ...info,
        category: info.category?.trim() ? info.category : category,
        description: info.description?.trim() ? info.description : description,
        currency: info.currency?.trim() || "RWF",
      },
      brandInformation: {
        ...project.brandInformation,
        name: project.brandInformation?.name?.trim() ? project.brandInformation.name : brand,
      },
      campaignInformation: {
        ...project.campaignInformation,
        name: project.campaignInformation.name?.trim() || `${info.name} campaign`,
        objective: project.campaignInformation.objective?.trim() || bf?.objective?.trim() || "Showcase product value",
        contentFormat: project.campaignInformation.contentFormat?.trim() || formatFromBrief?.trim() || "short-form video",
        callToAction: project.campaignInformation.callToAction?.trim() || ctaFromBrief?.trim() || undefined,
        tone: project.campaignInformation.tone?.trim() || bf?.tone?.trim() || undefined,
        style: project.campaignInformation.style?.trim() || bf?.style?.trim() || undefined,
        platforms: project.campaignInformation.platforms?.length ? project.campaignInformation.platforms : (bf?.platforms ?? []),
      },
      targetAudience: project.targetAudience?.trim() || audienceFromBrief || "Product buyers",
      language: project.language?.trim() || (langFromBrief === "Kinyarwanda" ? "rw" : langFromBrief === "English" ? "en" : langFromBrief?.toLowerCase().slice(0, 8)) || "rw",
      platform: project.platform?.trim() || platformFromBrief?.toLowerCase() || "instagram",
    };
    return this.updateProject(projectId, patch);
  }

  async saveProductionJob(projectId: string, job: Record<string, unknown>): Promise<CreativeProject> {
    this.ensureInitialized();
    const project = await this.getProject(projectId);
    if (!project) throw new Error("Project not found");
    return this.updateProject(projectId, {
      workspaceSettings: {
        ...project.workspaceSettings,
        productionJob: job,
      },
    });
  }

  async getProductionJob(projectId: string): Promise<Record<string, unknown> | null> {
    this.ensureInitialized();
    const project = await this.getProject(projectId);
    const job = project?.workspaceSettings?.productionJob;
    return job && typeof job === "object" ? job as Record<string, unknown> : null;
  }

  /** Step 4 Marketing Brief gate — objective, audience, platform (format/language default at production). */
  validateMarketingBrief(project: CreativeProject | null): ValidationResult {
    const errors: string[] = [];
    if (!project) errors.push("Create or open a project before continuing.");
    if (!project) return { valid: false, errors };
    if (!project.campaignInformation.objective.trim()) errors.push("Campaign objective is required.");
    if (!project.targetAudience.trim()) errors.push("Target audience is required.");
    if (!project.platform.trim() && !(project.campaignInformation.platforms?.length)) {
      errors.push("At least one marketing platform is required.");
    }
    return { valid: errors.length === 0, errors };
  }

  /** Step 5 Production Readiness gate — intake + profile + marketing. */
  validateProductionReadiness(project: CreativeProject | null): ValidationResult {
    const intake = this.validateIntake(project);
    const profile = this.validateProductProfile(project);
    const marketing = this.validateMarketingBrief(project);
    const errors = [...intake.errors, ...profile.errors, ...marketing.errors];
    return { valid: errors.length === 0, errors: [...new Set(errors)] };
  }

  getIntegrationStatus(): Record<string, boolean> {
    return {
      aiCore: this.core !== null,
      stateManager: this.core?.stateManager !== null && this.core?.stateManager !== undefined,
      moduleManager: this.core?.moduleManager !== null && this.core?.moduleManager !== undefined,
      memoryFoundation: this.core?.memoryFoundation !== null && this.core?.memoryFoundation !== undefined,
      knowledgeFoundation: this.core?.knowledgeFoundation !== null && this.core?.knowledgeFoundation !== undefined,
    };
  }

  /**
   * Persistence health + orphan report. Never deletes data.
   */
  async runPersistenceHealth(): Promise<CreativeWorkspacePersistenceHealth> {
    this.ensureInitialized();
    const checkedAt = new Date().toISOString();
    const issues: string[] = [];
    const orphans: CreativeWorkspaceOrphan[] = [];
    let projectsOk = 0;
    let projectsFailed = 0;
    let assetsOk = 0;
    let assetsMissingFile = 0;
    let workflowPresent = 0;
    let productPresent = 0;
    let marketingPresent = 0;

    let indexOk = true;
    try {
      this.index = await this.readJson<WorkspaceIndex>(this.indexPath(), this.index);
    } catch (error) {
      indexOk = false;
      issues.push(`workspace-session.json unreadable: ${error instanceof Error ? error.message : String(error)}`);
    }

    const projectsRoot = path.join(this.root, "projects");
    let diskProjectIds: string[] = [];
    try {
      const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
      diskProjectIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      diskProjectIds = [];
    }

    for (const id of diskProjectIds) {
      if (!this.index.projectIds.includes(id)) {
        orphans.push({
          kind: "project-dir-not-in-index",
          projectId: id,
          detail: `Directory projects/${id} exists but is not listed in workspace-session.json`,
        });
      }
    }
    for (const id of this.index.projectIds) {
      if (!diskProjectIds.includes(id)) {
        orphans.push({
          kind: "index-missing-project-dir",
          projectId: id,
          detail: `Index lists ${id} but projects/${id} is missing`,
        });
        projectsFailed += 1;
        continue;
      }

      const project = await this.getProject(id);
      if (!project) {
        projectsFailed += 1;
        issues.push(`project.json missing or invalid for ${id}`);
        orphans.push({
          kind: "missing-project-json",
          projectId: id,
          detail: `projects/${id}/project.json could not be loaded`,
        });
        continue;
      }
      projectsOk += 1;

      if (project.productInformation?.name?.trim()) productPresent += 1;
      if (
        project.campaignInformation?.name?.trim()
        || project.campaignInformation?.objective?.trim()
        || project.workspaceSettings?.marketingInputBrief
      ) {
        marketingPresent += 1;
      }
      if (project.workspaceSettings?.productCreation) workflowPresent += 1;

      const imageDir = path.join(this.projectPath(id), "images");
      let filesOnDisk: string[] = [];
      try {
        filesOnDisk = (await fs.readdir(imageDir)).filter((n) => !n.endsWith(".tmp"));
      } catch {
        filesOnDisk = [];
      }

      const metaNames = new Set<string>();
      const videoDir = path.join(this.projectPath(id), "videos");
      for (const image of project.productImages) {
        const extension = EXT_BY_MIME[image.mimeType]
          ?? (image.mimeType === "image/jpeg" ? "jpeg" : image.mimeType.split("/")[1] ?? "bin");
        const storedName = `${image.id}.${extension}`;
        const isVideo = image.assetType === "video" || image.mimeType.startsWith("video/");
        if (!isVideo) metaNames.add(storedName);
        const filePath = path.join(isVideo ? videoDir : imageDir, storedName);
        try {
          await fs.access(filePath);
          assetsOk += 1;
        } catch {
          assetsMissingFile += 1;
          orphans.push({
            kind: "asset-meta-missing-file",
            projectId: id,
            assetId: image.id,
            detail: `Metadata references ${storedName} but file is missing`,
          });
        }
      }

      for (const fileName of filesOnDisk) {
        if (fileName.endsWith(".tmp")) {
          orphans.push({
            kind: "temp-file",
            projectId: id,
            detail: `Temporary file left behind: ${fileName}`,
          });
          continue;
        }
        if (!metaNames.has(fileName)) {
          orphans.push({
            kind: "file-without-meta",
            projectId: id,
            detail: `File images/${fileName} has no matching productImages entry`,
          });
        }
      }
    }

    const writable = await this.probeWritable();
    if (!writable) issues.push("Creative workspace root is not writable");

    const criticalOrphans = orphans.filter(
      (o) => o.kind === "index-missing-project-dir" || o.kind === "missing-project-json",
    ).length;
    const ok = indexOk && writable && projectsFailed === 0 && assetsMissingFile === 0 && criticalOrphans === 0;

    return {
      ok,
      checkedAt,
      storageRoot: path.dirname(this.root),
      creativeWorkspaceRoot: this.root,
      indexOk,
      writable,
      projectCount: this.index.projectIds.length,
      projectsOk,
      projectsFailed,
      assetsOk,
      assetsMissingFile,
      workflowPresent,
      productPresent,
      marketingPresent,
      activeProjectId: this.index.activeProjectId,
      orphanCount: orphans.length,
      orphans,
      issues,
      note: "Thumbnails currently reuse stored full-size project copies (no separate thumbnail directory).",
    };
  }

  /**
   * Safety backup of creative-workspace into backups/creative-workspace/{id}.
   * Does not delete source data. Separate from PMC memory/knowledge backups.
   */
  async createPersistenceBackup(): Promise<{ ok: boolean; backupId: string; path: string; error?: string }> {
    this.ensureInitialized();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupId = `creative-workspace-${stamp}`;
    const dest = path.join(path.dirname(this.root), "backups", "creative-workspace", backupId);
    try {
      await fs.mkdir(dest, { recursive: true });
      await fs.cp(this.root, path.join(dest, "creative-workspace"), { recursive: true });
      const manifest = {
        backupId,
        createdAt: new Date().toISOString(),
        source: this.root,
        kind: "creative-workspace",
      };
      await this.writeJson(path.join(dest, "manifest.json"), manifest);
      return { ok: true, backupId, path: dest };
    } catch (error) {
      return {
        ok: false,
        backupId,
        path: dest,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async probeWritable(): Promise<boolean> {
    try {
      const probe = path.join(this.root, `.persist-probe-${process.pid}`);
      await fs.writeFile(probe, "ok", "utf8");
      await fs.unlink(probe);
      return true;
    } catch {
      return false;
    }
  }

  private async writeProjectRecord(project: CreativeProject, isNew = false): Promise<void> {
    this.transition(project.id, isNew ? ProjectState.Open : ProjectState.Modified);
    this.transition(project.id, ProjectState.Saving);
    await this.writeJson(this.projectFile(project.id), project);
    if (isNew) await this.saveIndex();
    this.transition(project.id, ProjectState.Saved);
  }

  private transition(projectId: string, state: ProjectState): void {
    this.core?.stateManager?.updateProjectState(projectId, state, {
      systemAction: "creative-workspace",
      metadata: { source: "creative-workspace" },
    });
  }

  private async requireProject(projectId: string): Promise<CreativeProject> {
    const project = await this.getProject(projectId);
    if (!project) throw new CreativeWorkspaceError("PROJECT_NOT_FOUND", "Project not found", 404);
    return project;
  }

  private async saveIndex(): Promise<void> {
    this.index.updatedAt = new Date().toISOString();
    await this.writeJson(this.indexPath(), this.index);
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      throw new Error(`Unable to read workspace storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    const temporaryPath = `${filePath}.${createHash("sha1").update(randomUUID()).digest("hex")}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, filePath);
  }

  private async writeBinaryAtomic(filePath: string, data: Buffer): Promise<void> {
    const temporaryPath = `${filePath}.${createHash("sha1").update(randomUUID()).digest("hex")}.tmp`;
    await fs.writeFile(temporaryPath, data);
    await fs.rename(temporaryPath, filePath);
  }

  private ensureInitialized(): void {
    if (!this.root) throw new Error("Creative Workspace Manager is not initialized");
  }

  private indexPath(): string { return path.join(this.root, "workspace-session.json"); }
  private projectPath(projectId: string): string { return path.join(this.root, "projects", projectId); }
  private projectFile(projectId: string): string { return path.join(this.projectPath(projectId), "project.json"); }
}