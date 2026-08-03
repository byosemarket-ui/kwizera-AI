import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { CreativeReviewManager, type ExportFormat } from "../creative-review/creative-review-manager.js";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageGenerationManager } from "../image-generation/image-generation-manager.js";
import type { ImageGenerationRequest, ImageStyle } from "../image-generation/types.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";

export type ProductPhotographyView = "hero" | "front" | "side" | "rear" | "top" | "bottom" | "three-quarter" | "macro" | "detail";
export type ProductStudio = "white" | "luxury" | "fashion" | "electronics" | "premium" | "lifestyle" | "indoor" | "outdoor" | "transparent";
export type ProductLighting = "studio" | "softbox" | "rim" | "natural" | "luxury" | "dramatic" | "commercial";
export type ProductShadow = "soft" | "hard" | "contact" | "floating";
export type ProductReflection = "none" | "mirror" | "glass" | "premium";
export type ProductPhotographyStatus = "queued" | "running" | "completed" | "failed";

export interface ProductPhotographyRequest {
  projectId: string;
  views?: ProductPhotographyView[];
  studio?: ProductStudio;
  lighting?: ProductLighting;
  shadow?: ProductShadow;
  reflection?: ProductReflection;
  resolution?: "standard" | "high";
  maxAttempts?: number;
}

export interface ProductPhotographyJob {
  id: string;
  projectId: string;
  status: ProductPhotographyStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  request: Required<Omit<ProductPhotographyRequest, "projectId">>;
  completedViews: ProductPhotographyView[];
  imageIds: string[];
  attempts: number;
  error?: string;
}

interface Store {
  jobs: ProductPhotographyJob[];
}

const DEFAULT_VIEWS: ProductPhotographyView[] = ["hero", "front", "side", "three-quarter", "detail"];

/** Orchestrates product-photo batches through the existing local image inference owner. */
export class ProductPhotographyManager {
  private root = "";
  private store: Store = { jobs: [] };

  constructor(
    private readonly workspace: CreativeWorkspaceManager,
    private readonly images: ImageGenerationManager,
    private readonly products: ProductIntelligenceManager,
    private readonly imageIntelligence: ImageIntelligenceManager,
    private readonly review: CreativeReviewManager
  ) {}

  async initialize(storageRoot: string): Promise<void> {
    this.root = path.join(storageRoot, "product-photography");
    await fs.mkdir(this.root, { recursive: true });
    this.store = await this.readStore();
  }

  list(projectId?: string): ProductPhotographyJob[] {
    return this.store.jobs.filter((job) => !projectId || job.projectId === projectId).map((job) => structuredClone(job));
  }

  async start(input: ProductPhotographyRequest): Promise<ProductPhotographyJob> {
    this.ensureReady();
    const request = normalizeRequest(input);
    const active = this.store.jobs.find((job) => job.projectId === input.projectId && (job.status === "queued" || job.status === "running"));
    if (active) return structuredClone(active);
    const now = new Date().toISOString();
    const job: ProductPhotographyJob = { id: randomUUID(), projectId: input.projectId, status: "queued", createdAt: now, updatedAt: now, request, completedViews: [], imageIds: [], attempts: 0 };
    this.store.jobs.unshift(job);
    await this.persist();
    await this.run(job);
    return structuredClone(job);
  }

  private async run(job: ProductPhotographyJob): Promise<void> {
    job.status = "running";
    job.updatedAt = new Date().toISOString();
    await this.persist();
    try {
      const project = await this.workspace.getProject(job.projectId);
      const validation = this.workspace.validate(project);
      if (!validation.valid) throw new Error(validation.errors.join(" "));
      const [product, imageProfiles] = await Promise.all([this.products.analyze(job.projectId), this.imageIntelligence.analyzeProject(job.projectId)]);
      for (const view of job.request.views) {
        const image = await this.generateWithRecovery(job, view, product.category, imageProfiles.length);
        await this.exportPhoto(job.projectId, view, image.id, image.fileName, image.mimeType);
        job.completedViews.push(view);
        job.imageIds.push(image.id);
        job.updatedAt = new Date().toISOString();
        await this.persist();
      }
      job.status = "completed";
      job.completedAt = new Date().toISOString();
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
    }
    job.updatedAt = new Date().toISOString();
    await this.persist();
  }

  private async generateWithRecovery(job: ProductPhotographyJob, view: ProductPhotographyView, category: string, imageEvidenceCount: number) {
    let failure: unknown;
    for (let attempt = 1; attempt <= job.request.maxAttempts; attempt++) {
      job.attempts++;
      try {
        const generated = await this.images.generate(this.toImageRequest(job, view, category, imageEvidenceCount, attempt));
        const image = generated[0];
        if (!image || image.quality.score < 80) throw new Error("Generated product image did not meet the local quality threshold");
        return image;
      } catch (error) {
        failure = error;
      }
    }
    throw failure instanceof Error ? failure : new Error(String(failure));
  }

  private toImageRequest(job: ProductPhotographyJob, view: ProductPhotographyView, category: string, imageEvidenceCount: number, attempt: number): ImageGenerationRequest {
    const studio = studioDirective(job.request.studio);
    const prompt = [
      `${viewDirective(view)} professional e-commerce product photograph`,
      `${category} product, preserve exact product shape, label, color, size, material, and logo`,
      studio,
      `${job.request.lighting} lighting`,
      `${job.request.shadow} shadow`,
      job.request.reflection === "none" ? "no artificial reflection" : `${job.request.reflection} reflection`,
      `${imageEvidenceCount} source image evidence profile(s) analyzed`,
      `quality-validation attempt ${attempt}`,
    ].join(", ");
    return {
      projectId: job.projectId,
      prompt,
      mode: "product-to-image",
      style: styleFor(job.request.studio),
      aspectRatio: view === "hero" ? "4:5" : "1:1",
      resolution: job.request.resolution,
      count: 1,
      scene: sceneFor(job.request.studio),
      background: backgroundFor(job.request.studio),
      lighting: lightingFor(job.request.lighting),
      shadow: shadowFor(job.request.shadow),
      reflection: reflectionFor(job.request.reflection),
      seed: attempt,
    };
  }

  private async exportPhoto(projectId: string, view: ProductPhotographyView, imageId: string, fileName: string, mimeType: "image/png" | "image/jpeg" | "image/webp"): Promise<void> {
    const assetPath = await this.images.getAssetPath(imageId);
    if (!assetPath) throw new Error("Generated product photo asset is unavailable for export");
    const name = `Product photography ${view} - ${fileName}`;
    const state = await this.review.getProjectState(projectId);
    let asset = state.assets.find((candidate) => candidate.name === name);
    if (!asset) {
      asset = await this.review.ingestAsset(projectId, { name, mimeType, dataBase64: (await fs.readFile(assetPath)).toString("base64") });
    }
    if (!asset.approved) await this.review.approve(projectId, asset.id);
    await this.review.exportAsset(projectId, asset.id, { format: exportFormat(mimeType), platform: "ecommerce", resolution: "source", quality: "high" });
  }

  private async readStore(): Promise<Store> {
    try {
      const value = JSON.parse(await fs.readFile(path.join(this.root, "jobs.json"), "utf8")) as Partial<Store>;
      return { jobs: value.jobs ?? [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { jobs: [] };
      throw error;
    }
  }

  private async persist(): Promise<void> {
    const target = path.join(this.root, "jobs.json");
    const temporary = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(this.store, null, 2)}\n`, "utf8");
    await fs.rename(temporary, target);
  }

  private ensureReady(): void {
    if (!this.root) throw new Error("Product Photography Manager is not initialized");
  }
}

function normalizeRequest(input: ProductPhotographyRequest): Required<Omit<ProductPhotographyRequest, "projectId">> {
  const views = input.views?.length ? [...new Set(input.views)] : DEFAULT_VIEWS;
  if (views.length > 12) throw new Error("A product photography job supports at most 12 views");
  return { views, studio: input.studio ?? "white", lighting: input.lighting ?? "commercial", shadow: input.shadow ?? "contact", reflection: input.reflection ?? "none", resolution: input.resolution ?? "high", maxAttempts: input.maxAttempts ?? 2 };
}

function viewDirective(view: ProductPhotographyView): string { return ({ hero: "hero shot at a 45-degree angle", front: "front view", side: "side profile view", rear: "rear view", top: "top-down view", bottom: "bottom view", "three-quarter": "three-quarter 45-degree view", macro: "macro material view", detail: "close detail shot" })[view]; }
function studioDirective(studio: ProductStudio): string { return studio === "transparent" ? "transparent seamless background" : `${studio} studio environment`; }
function styleFor(studio: ProductStudio): ImageStyle { return studio === "luxury" || studio === "premium" ? "luxury" : studio === "fashion" ? "editorial" : studio === "lifestyle" || studio === "outdoor" ? "lifestyle" : "studio"; }
function sceneFor(studio: ProductStudio): NonNullable<ImageGenerationRequest["scene"]> { return ({ white: "white-studio", luxury: "luxury-studio", fashion: "fashion-studio", electronics: "electronics-studio", premium: "premium-display", lifestyle: "lifestyle", indoor: "indoor", outdoor: "outdoor", transparent: "white-studio" })[studio]; }
function backgroundFor(studio: ProductStudio): NonNullable<ImageGenerationRequest["background"]> { return ({ white: "white", luxury: "luxury", fashion: "modern-room", electronics: "glass", premium: "marble", lifestyle: "nature", indoor: "office", outdoor: "nature", transparent: "transparent" })[studio]; }
function lightingFor(lighting: ProductLighting): NonNullable<ImageGenerationRequest["lighting"]> { return ({ studio: "studio", softbox: "soft", rim: "product-highlights", natural: "natural", luxury: "luxury", dramatic: "product-highlights", commercial: "studio" })[lighting]; }
function shadowFor(shadow: ProductShadow): NonNullable<ImageGenerationRequest["shadow"]> { return ({ soft: "soft", hard: "hard", contact: "floor", floating: "floating" })[shadow]; }
function reflectionFor(reflection: ProductReflection): NonNullable<ImageGenerationRequest["reflection"]> { return ({ none: "gloss", mirror: "mirror", glass: "glass", premium: "gloss" })[reflection]; }
function exportFormat(mimeType: "image/png" | "image/jpeg" | "image/webp"): ExportFormat { return mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "webp"; }