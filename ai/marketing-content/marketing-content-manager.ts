import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { CreativeReviewManager, type ExportFormat } from "../creative-review/creative-review-manager.js";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageGenerationManager } from "../image-generation/image-generation-manager.js";
import type { ImageGenerationRequest, ImageStyle } from "../image-generation/types.js";
import type { MarketingIntelligenceManager } from "../marketing-intelligence/marketing-intelligence-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";

export type MarketingAssetType = "poster" | "flyer" | "brochure" | "banner" | "roll-up-banner" | "business-card" | "social-post" | "catalog" | "promotional-card" | "campaign-asset";
export type MarketingPlatform = "facebook" | "instagram" | "tiktok" | "linkedin" | "x" | "youtube" | "whatsapp" | "print";
export type MarketingContentStatus = "queued" | "running" | "completed" | "failed";

export interface MarketingContentRequest {
  projectId: string;
  assetTypes?: MarketingAssetType[];
  platforms?: MarketingPlatform[];
  language?: "en" | "rw";
  maxAttempts?: number;
}

export interface MarketingCopy {
  headline: string;
  description: string;
  offer: string;
  cta: string;
  caption: string;
  hashtags: string[];
}

export interface MarketingContentJob {
  id: string;
  projectId: string;
  status: MarketingContentStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  request: Required<Omit<MarketingContentRequest, "projectId">>;
  copy?: MarketingCopy;
  completedAssets: Array<{ type: MarketingAssetType; platform: MarketingPlatform; imageId: string; exportFileName: string }>;
  attempts: number;
  error?: string;
}

interface Store { jobs: MarketingContentJob[]; }
const DEFAULT_ASSETS: MarketingAssetType[] = ["social-post", "banner", "poster"];
const DEFAULT_PLATFORMS: MarketingPlatform[] = ["instagram"];

/** Builds local-first marketing packages without replacing the existing brand, generation, or export owners. */
export class MarketingContentManager {
  private root = "";
  private store: Store = { jobs: [] };

  constructor(
    private readonly workspace: CreativeWorkspaceManager,
    private readonly products: ProductIntelligenceManager,
    private readonly marketing: MarketingIntelligenceManager,
    private readonly images: ImageGenerationManager,
    private readonly review: CreativeReviewManager
  ) {}

  async initialize(storageRoot: string): Promise<void> {
    this.root = path.join(storageRoot, "marketing-content");
    await fs.mkdir(this.root, { recursive: true });
    this.store = await this.readStore();
  }

  list(projectId?: string): MarketingContentJob[] {
    return this.store.jobs.filter((job) => !projectId || job.projectId === projectId).map((job) => structuredClone(job));
  }

  async start(input: MarketingContentRequest): Promise<MarketingContentJob> {
    this.ensureReady();
    const request = normalizeRequest(input);
    const active = this.store.jobs.find((job) => job.projectId === input.projectId && (job.status === "queued" || job.status === "running"));
    if (active) return structuredClone(active);
    const now = new Date().toISOString();
    const job: MarketingContentJob = { id: randomUUID(), projectId: input.projectId, status: "queued", createdAt: now, updatedAt: now, request, completedAssets: [], attempts: 0 };
    this.store.jobs.unshift(job); await this.persist(); await this.run(job); return structuredClone(job);
  }

  async startBatch(inputs: MarketingContentRequest[]): Promise<MarketingContentJob[]> {
    if (!inputs.length || inputs.length > 100) throw new Error("A marketing batch must contain between 1 and 100 projects");
    const jobs: MarketingContentJob[] = [];
    for (const input of inputs) jobs.push(await this.start(input));
    return jobs;
  }

  private async run(job: MarketingContentJob): Promise<void> {
    job.status = "running"; job.updatedAt = new Date().toISOString(); await this.persist();
    try {
      const project = await this.workspace.getProject(job.projectId);
      const validation = this.workspace.validate(project);
      if (!validation.valid) throw new Error(validation.errors.join(" "));
      const [product, strategy] = await Promise.all([this.products.analyze(job.projectId), this.marketing.analyze(job.projectId)]);
      job.copy = createCopy(project!.productInformation.name, project!.brandInformation.name, strategy.valueProposition, strategy.ctas[0], job.request.language);
      for (const type of job.request.assetTypes) for (const platform of job.request.platforms) {
        const completed = await this.generateAsset(job, type, platform, product.category, strategy);
        job.completedAssets.push(completed); job.updatedAt = new Date().toISOString(); await this.persist();
      }
      job.status = "completed"; job.completedAt = new Date().toISOString();
    } catch (error) {
      job.status = "failed"; job.error = error instanceof Error ? error.message : String(error);
    }
    job.updatedAt = new Date().toISOString(); await this.persist();
  }

  private async generateAsset(job: MarketingContentJob, type: MarketingAssetType, platform: MarketingPlatform, category: string, strategy: Awaited<ReturnType<MarketingIntelligenceManager["analyze"]>>): Promise<MarketingContentJob["completedAssets"][number]> {
    let failure: unknown;
    for (let attempt = 1; attempt <= job.request.maxAttempts; attempt++) {
      job.attempts++;
      try {
        const generated = await this.images.generate(this.imageRequest(job, type, platform, category, strategy, attempt));
        const image = generated[0];
        if (!image || image.quality.score < 80) throw new Error("Generated marketing visual did not meet the local quality threshold");
        const exportFileName = await this.exportAsset(job.projectId, type, platform, image.id, image.fileName, image.mimeType);
        return { type, platform, imageId: image.id, exportFileName };
      } catch (error) { failure = error; }
    }
    throw failure instanceof Error ? failure : new Error(String(failure));
  }

  private imageRequest(job: MarketingContentJob, type: MarketingAssetType, platform: MarketingPlatform, category: string, strategy: Awaited<ReturnType<MarketingIntelligenceManager["analyze"]>>, attempt: number): ImageGenerationRequest {
    const copy = job.copy!;
    const format = formatFor(type, platform);
    return {
      projectId: job.projectId,
      prompt: `${type} marketing visual for ${platform}, ${category} product, ${strategy.brand.identity} brand identity, ${strategy.brand.consistency}, ${strategy.campaign.objective}, visual hierarchy with image placement and CTA area, ${format.description}, use this approved copy as layout guidance: ${copy.headline}. ${copy.cta}. Do not render illegible text or altered logo. Quality-validation attempt ${attempt}`,
      mode: "product-to-image",
      style: styleFor(platform),
      aspectRatio: format.aspectRatio,
      resolution: "high",
      count: 1,
      scene: platform === "print" ? "premium-display" : "lifestyle",
      background: "modern-room",
      lighting: "product-highlights",
      shadow: "soft",
      reflection: "gloss",
      seed: attempt,
    };
  }

  private async exportAsset(projectId: string, type: MarketingAssetType, platform: MarketingPlatform, imageId: string, fileName: string, mimeType: "image/png" | "image/jpeg" | "image/webp"): Promise<string> {
    const source = await this.images.getAssetPath(imageId);
    if (!source) throw new Error("Generated marketing visual is unavailable for export");
    const name = `Marketing ${type} ${platform} - ${fileName}`;
    const state = await this.review.getProjectState(projectId);
    let asset = state.assets.find((candidate) => candidate.name === name);
    if (!asset) asset = await this.review.ingestAsset(projectId, { name, mimeType, dataBase64: (await fs.readFile(source)).toString("base64") });
    if (!asset.approved) await this.review.approve(projectId, asset.id);
    return (await this.review.exportAsset(projectId, asset.id, { format: exportFormat(mimeType), platform, resolution: "source", quality: "high" })).fileName;
  }

  private async readStore(): Promise<Store> {
    try { const value = JSON.parse(await fs.readFile(path.join(this.root, "jobs.json"), "utf8")) as Partial<Store>; return { jobs: value.jobs ?? [] }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { jobs: [] }; throw error; }
  }
  private async persist(): Promise<void> { const target = path.join(this.root, "jobs.json"); const temporary = `${target}.${randomUUID()}.tmp`; await fs.writeFile(temporary, `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); await fs.rename(temporary, target); }
  private ensureReady(): void { if (!this.root) throw new Error("Marketing Content Manager is not initialized"); }
}

function normalizeRequest(input: MarketingContentRequest): Required<Omit<MarketingContentRequest, "projectId">> {
  const assetTypes = input.assetTypes?.length ? [...new Set(input.assetTypes)] : DEFAULT_ASSETS;
  const platforms = input.platforms?.length ? [...new Set(input.platforms)] : DEFAULT_PLATFORMS;
  if (assetTypes.length * platforms.length > 40) throw new Error("A marketing job supports at most 40 output assets");
  return { assetTypes, platforms, language: input.language ?? "en", maxAttempts: input.maxAttempts ?? 2 };
}
function createCopy(product: string, brand: string, value: string, cta: string, language: "en" | "rw"): MarketingCopy {
  if (language === "rw") return { headline: `${product}: hitamo ibyiza bya ${brand}`, description: value, offer: "Kwamamaza kw'igihe gito", cta: cta || "Menya byinshi", caption: `${product} igenewe ibyo ukeneye buri munsi.`, hashtags: ["#Kwamamaza", "#KwamamazaRwanda", `#${brand.replace(/\s+/g, "")}`] };
  return { headline: `${product} by ${brand}`, description: value, offer: "Limited-time campaign offer", cta: cta || "Learn more", caption: `${product} brings clear value to your everyday routine.`, hashtags: ["#Marketing", "#ProductLaunch", `#${brand.replace(/\s+/g, "")}`] };
}
function formatFor(type: MarketingAssetType, platform: MarketingPlatform): { aspectRatio: ImageGenerationRequest["aspectRatio"]; description: string } {
  if (type === "roll-up-banner") return { aspectRatio: "9:16", description: "vertical roll-up banner composition" };
  if (type === "banner" || platform === "youtube" || platform === "x") return { aspectRatio: "16:9", description: "wide banner composition" };
  if (platform === "tiktok" || platform === "whatsapp") return { aspectRatio: "9:16", description: "vertical social composition" };
  if (platform === "instagram" || platform === "facebook") return { aspectRatio: "4:5", description: "feed-first social composition" };
  return { aspectRatio: "1:1", description: "balanced print-ready composition" };
}
function styleFor(platform: MarketingPlatform): ImageStyle { return platform === "linkedin" ? "editorial" : platform === "tiktok" || platform === "instagram" ? "bold" : platform === "print" ? "minimal" : "studio"; }
function exportFormat(mimeType: "image/png" | "image/jpeg" | "image/webp"): ExportFormat { return mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "webp"; }