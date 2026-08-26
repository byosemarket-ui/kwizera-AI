import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { ProjectState } from "../state-manager/types.js";

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
}

export interface BrandInformation {
  name: string;
  website?: string;
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
};

/**
 * Creative Workspace Manager owns Step 1 project inputs only. It deliberately
 * has no generation, prompt, rendering, or export responsibilities.
 */
export class CreativeWorkspaceManager {
  private core: AiCoreManager | null = null;
  private root = "";
  private index: WorkspaceIndex = { projectIds: [], activeProjectId: null, updatedAt: "" };

  async initialize(storageRoot: string, core?: AiCoreManager): Promise<void> {
    this.core = core ?? null;
    this.root = path.join(storageRoot, "creative-workspace");
    await fs.mkdir(path.join(this.root, "projects"), { recursive: true });
    this.index = await this.readJson<WorkspaceIndex>(this.indexPath(), {
      projectIds: [], activeProjectId: null, updatedAt: new Date().toISOString(),
    });
    await this.saveIndex();
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
    };

    await fs.mkdir(this.projectPath(project.id), { recursive: true });
    this.index.projectIds.unshift(project.id);
    this.index.activeProjectId = project.id;
    await this.persist(project, true);
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
    return this.readJson<CreativeProject | null>(this.projectFile(projectId), null);
  }

  async getActiveProject(): Promise<CreativeProject | null> {
    return this.index.activeProjectId ? this.getProject(this.index.activeProjectId) : null;
  }

  async openProject(projectId: string): Promise<CreativeProject> {
    const project = await this.requireProject(projectId);
    this.index.activeProjectId = project.id;
    await this.saveIndex();
    this.transition(project.id, ProjectState.Open);
    return project;
  }

  async updateProject(projectId: string, changes: Partial<Omit<CreativeProject, "id" | "createdAt" | "modifiedAt" | "productImages">>): Promise<CreativeProject> {
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
    await this.persist(updated);
    return updated;
  }

  async uploadImage(projectId: string, image: UploadedImageInput): Promise<ProductImage> {
    const project = await this.requireProject(projectId);
    if (FUTURE_IMAGE_TYPES.has(image.mimeType)) {
      throw new Error(`Format ${image.mimeType} is reserved for a future release and is not enabled yet`);
    }
    if (!ALLOWED_IMAGE_TYPES.has(image.mimeType)) {
      throw new Error("Unsupported format. Supported: JPG, JPEG, PNG, WEBP, TIFF, BMP");
    }
    const data = Buffer.from(image.dataBase64, "base64");
    if (!data.length || data.length > MAX_IMAGE_BYTES) {
      throw new Error("Product image must be between 1 byte and 25 MB");
    }

    const extension = EXT_BY_MIME[image.mimeType] ?? image.mimeType.split("/")[1]?.replace("x-ms-", "") ?? "bin";
    const id = randomUUID();
    const safeName = path.basename(image.fileName).replace(/[^a-zA-Z0-9._-]/g, "_") || `product.${extension}`;
    const storedName = `${id}.${extension}`;
    const imageDirectory = path.join(this.projectPath(projectId), "images");
    await fs.mkdir(imageDirectory, { recursive: true });
    // Project-owned copy only — never touch the user's original Windows path.
    // Atomic write: temp → rename (avoids half-written files on crash).
    await this.writeBinaryAtomic(path.join(imageDirectory, storedName), data);

    const checksumSha256 = image.checksumSha256 ?? createHash("sha256").update(data).digest("hex");
    const uploaded: ProductImage = {
      id,
      fileName: safeName,
      mimeType: image.mimeType === "image/x-ms-bmp" ? "image/bmp" : image.mimeType,
      sizeBytes: data.length,
      uploadedAt: new Date().toISOString(),
      url: `/api/workspace/projects/${projectId}/images/${storedName}`,
      width: image.width,
      height: image.height,
      checksumSha256,
      sourceFileName: image.fileName,
    };
    project.productImages.push(uploaded);
    project.modifiedAt = uploaded.uploadedAt;
    await this.persist(project);
    return uploaded;
  }

  async removeImage(projectId: string, imageId: string): Promise<CreativeProject> {
    const project = await this.requireProject(projectId);
    const image = project.productImages.find((item) => item.id === imageId);
    if (!image) throw new Error("Image not found");
    const extension = EXT_BY_MIME[image.mimeType] ?? image.mimeType.split("/")[1] ?? "bin";
    const storedName = `${image.id}.${extension}`;
    const filePath = path.join(this.projectPath(projectId), "images", storedName);
    try {
      await fs.unlink(filePath);
    } catch {
      /* file may already be missing — still drop metadata */
    }
    project.productImages = project.productImages.filter((item) => item.id !== imageId);
    project.modifiedAt = new Date().toISOString();
    await this.persist(project);
    return project;
  }

  async getImagePath(projectId: string, imageFile: string): Promise<string | null> {
    if (!/^[a-f0-9-]+\.(jpe?g|png|webp|tiff?|bmp)$/i.test(imageFile)) return null;
    const filePath = path.join(this.projectPath(projectId), "images", imageFile);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  /** Resolve the absolute path of an original uploaded product image. Never used for writes by asset prep. */
  async getOriginalImagePath(projectId: string, imageId: string): Promise<string | null> {
    const project = await this.getProject(projectId);
    const image = project?.productImages.find((item) => item.id === imageId);
    if (!image) return null;
    const extension = EXT_BY_MIME[image.mimeType] ?? (image.mimeType === "image/jpeg" ? "jpeg" : image.mimeType.split("/")[1]);
    return this.getImagePath(projectId, `${imageId}.${extension}`);
  }

  /** Full creative brief validation (later steps). */
  validate(project: CreativeProject | null): ValidationResult {
    const errors: string[] = [];
    if (!project) errors.push("Create or open a project before continuing.");
    if (!project) return { valid: false, errors };
    if (!project.name.trim()) errors.push("Project name is required.");
    if (!project.productImages.length) errors.push("Upload at least one product image.");
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
    if (!project.productImages.length) errors.push("Import at least one valid product image.");
    return { valid: errors.length === 0, errors };
  }

  /** Step 3 Product Profile gate — critical commerce fields + images. */
  validateProductProfile(project: CreativeProject | null): ValidationResult {
    const errors: string[] = [];
    if (!project) errors.push("Create or open a project before continuing.");
    if (!project) return { valid: false, errors };
    if (!project.name.trim() && !project.productInformation.name.trim()) errors.push("Product name is required.");
    if (!project.productInformation.name.trim()) errors.push("Product name is required.");
    if (!project.productInformation.category.trim()) errors.push("Product category is required.");
    if (project.productInformation.price == null || !Number.isFinite(project.productInformation.price) || project.productInformation.price < 0) {
      errors.push("A valid selling price is required.");
    }
    if (project.productInformation.price != null && !String(project.productInformation.currency ?? "").trim()) {
      errors.push("Currency is required when a price is set.");
    }
    if (!project.productImages.length) errors.push("At least one product image is required.");
    return { valid: errors.length === 0, errors };
  }

  /** Step 4 Marketing Brief gate — objective, audience, platform, language, format. */
  validateMarketingBrief(project: CreativeProject | null): ValidationResult {
    const errors: string[] = [];
    if (!project) errors.push("Create or open a project before continuing.");
    if (!project) return { valid: false, errors };
    if (!project.campaignInformation.objective.trim()) errors.push("Campaign objective is required.");
    if (!project.targetAudience.trim()) errors.push("Target audience is required.");
    if (!project.platform.trim() && !(project.campaignInformation.platforms?.length)) {
      errors.push("At least one marketing platform is required.");
    }
    if (!project.language.trim()) errors.push("Language is required.");
    if (!String(project.campaignInformation.contentFormat ?? "").trim()) {
      errors.push("Content format is required.");
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
      for (const image of project.productImages) {
        const extension = EXT_BY_MIME[image.mimeType]
          ?? (image.mimeType === "image/jpeg" ? "jpeg" : image.mimeType.split("/")[1] ?? "bin");
        const storedName = `${image.id}.${extension}`;
        metaNames.add(storedName);
        const filePath = path.join(imageDir, storedName);
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

  private async persist(project: CreativeProject, isNew = false): Promise<void> {
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
    if (!project) throw new Error("Project not found");
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