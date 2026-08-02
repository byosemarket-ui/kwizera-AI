import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { ProjectState } from "../state-manager/types.js";

export interface ProductInformation {
  name: string;
  category: string;
  description: string;
  sku?: string;
}

export interface BrandInformation {
  name: string;
  website?: string;
  voice?: string;
  guidelines?: string;
}

export interface CampaignInformation {
  name: string;
  objective: string;
  callToAction?: string;
  notes?: string;
}

export interface ProductImage {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  url: string;
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
}

interface WorkspaceIndex {
  projectIds: string[];
  activeProjectId: string | null;
  updatedAt: string;
}

const EMPTY_PRODUCT: ProductInformation = { name: "", category: "", description: "" };
const EMPTY_BRAND: BrandInformation = { name: "" };
const EMPTY_CAMPAIGN: CampaignInformation = { name: "", objective: "" };
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

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
    if (!ALLOWED_IMAGE_TYPES.has(image.mimeType)) {
      throw new Error("Only JPEG, PNG, and WebP product images are supported");
    }
    const data = Buffer.from(image.dataBase64, "base64");
    if (!data.length || data.length > MAX_IMAGE_BYTES) {
      throw new Error("Product image must be between 1 byte and 15 MB");
    }

    const extension = image.mimeType.split("/")[1];
    const id = randomUUID();
    const safeName = path.basename(image.fileName).replace(/[^a-zA-Z0-9._-]/g, "_") || `product.${extension}`;
    const storedName = `${id}.${extension}`;
    const imageDirectory = path.join(this.projectPath(projectId), "images");
    await fs.mkdir(imageDirectory, { recursive: true });
    await fs.writeFile(path.join(imageDirectory, storedName), data);

    const uploaded: ProductImage = {
      id,
      fileName: safeName,
      mimeType: image.mimeType,
      sizeBytes: data.length,
      uploadedAt: new Date().toISOString(),
      url: `/api/workspace/projects/${projectId}/images/${storedName}`,
    };
    project.productImages.push(uploaded);
    project.modifiedAt = uploaded.uploadedAt;
    await this.persist(project);
    return uploaded;
  }

  async getImagePath(projectId: string, imageFile: string): Promise<string | null> {
    if (!/^[a-f0-9-]+\.(jpeg|png|webp)$/i.test(imageFile)) return null;
    const filePath = path.join(this.projectPath(projectId), "images", imageFile);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

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

  getIntegrationStatus(): Record<string, boolean> {
    return {
      aiCore: this.core !== null,
      stateManager: this.core?.stateManager !== null && this.core?.stateManager !== undefined,
      moduleManager: this.core?.moduleManager !== null && this.core?.moduleManager !== undefined,
      memoryFoundation: this.core?.memoryFoundation !== null && this.core?.memoryFoundation !== undefined,
      knowledgeFoundation: this.core?.knowledgeFoundation !== null && this.core?.knowledgeFoundation !== undefined,
    };
  }

  private async persist(project: CreativeProject, isNew = false): Promise<void> {
    this.transition(project.id, isNew ? ProjectState.Open : ProjectState.Modified);
    this.transition(project.id, ProjectState.Saving);
    await this.writeJson(this.projectFile(project.id), project);
    await this.saveIndex();
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

  private ensureInitialized(): void {
    if (!this.root) throw new Error("Creative Workspace Manager is not initialized");
  }

  private indexPath(): string { return path.join(this.root, "workspace-session.json"); }
  private projectPath(projectId: string): string { return path.join(this.root, "projects", projectId); }
  private projectFile(projectId: string): string { return path.join(this.projectPath(projectId), "project.json"); }
}