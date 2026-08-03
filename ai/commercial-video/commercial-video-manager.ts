import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { CreativeReviewManager, type ExportFormat } from "../creative-review/creative-review-manager.js";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageGenerationManager } from "../image-generation/image-generation-manager.js";
import type { MarketingIntelligenceManager } from "../marketing-intelligence/marketing-intelligence-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { GeneratedVideoPackage, VideoGenerationRequest } from "../video-audio-generation/types.js";
import type { VideoAudioGenerationManager } from "../video-audio-generation/video-audio-generation-manager.js";

export type CommercialFormat = "product-commercial" | "tiktok" | "instagram-reel" | "facebook-ad" | "youtube-short" | "youtube-commercial" | "tv-commercial" | "product-showcase" | "brand-promotion";
export type CommercialStatus = "queued" | "running" | "completed" | "failed";

export interface CommercialVideoRequest { projectId: string; format?: CommercialFormat; language?: "en" | "rw"; durationSeconds?: number; maxAttempts?: number; }
export interface CommercialScene { order: number; kind: "opening" | "introduction" | "hero" | "features" | "lifestyle" | "branding" | "offer" | "cta"; camera: VideoGenerationRequest["camera"]; animation: NonNullable<VideoGenerationRequest["animation"]>; narration: string; }
export interface CommercialVideoJob { id: string; projectId: string; status: CommercialStatus; createdAt: string; updatedAt: string; completedAt?: string; request: Required<Omit<CommercialVideoRequest, "projectId">>; storyboard: CommercialScene[]; attempts: number; keyImageId?: string; videoPackageId?: string; subtitleFileName?: string; exportFileName?: string; error?: string; }
interface Store { jobs: CommercialVideoJob[]; }

/** Coordinates commercial-video jobs through existing local image/video inference and review/export managers. */
export class CommercialVideoManager {
  private root = "";
  private store: Store = { jobs: [] };

  constructor(private readonly workspace: CreativeWorkspaceManager, private readonly products: ProductIntelligenceManager, private readonly marketing: MarketingIntelligenceManager, private readonly images: ImageGenerationManager, private readonly videos: VideoAudioGenerationManager, private readonly review: CreativeReviewManager) {}

  async initialize(storageRoot: string): Promise<void> { this.root = path.join(storageRoot, "commercial-video"); await fs.mkdir(this.root, { recursive: true }); this.store = await this.readStore(); }
  list(projectId?: string): CommercialVideoJob[] { return this.store.jobs.filter((job) => !projectId || job.projectId === projectId).map((job) => structuredClone(job)); }
  async start(input: CommercialVideoRequest): Promise<CommercialVideoJob> {
    this.ensureReady(); const request = normalize(input); const active = this.store.jobs.find((job) => job.projectId === input.projectId && (job.status === "queued" || job.status === "running")); if (active) return structuredClone(active);
    const now = new Date().toISOString(); const job: CommercialVideoJob = { id: randomUUID(), projectId: input.projectId, status: "queued", createdAt: now, updatedAt: now, request, storyboard: [], attempts: 0 };
    this.store.jobs.unshift(job); await this.persist(); await this.run(job); return structuredClone(job);
  }
  async startBatch(inputs: CommercialVideoRequest[]): Promise<CommercialVideoJob[]> { if (!inputs.length || inputs.length > 100) throw new Error("A commercial batch must contain between 1 and 100 projects"); const jobs: CommercialVideoJob[] = []; for (const input of inputs) jobs.push(await this.start(input)); return jobs; }

  private async run(job: CommercialVideoJob): Promise<void> {
    job.status = "running"; job.updatedAt = new Date().toISOString(); await this.persist();
    try {
      const project = await this.workspace.getProject(job.projectId); const validation = this.workspace.validate(project); if (!validation.valid) throw new Error(validation.errors.join(" "));
      const [product, strategy] = await Promise.all([this.products.analyze(job.projectId), this.marketing.analyze(job.projectId)]);
      job.storyboard = storyboard(project!.productInformation.name, strategy.ctas[0], job.request.language);
      const image = (await this.images.generate({ projectId: job.projectId, prompt: `${product.category} product hero shot for a cinematic ${job.request.format}, preserve exact product shape, label, colour, and logo`, mode: "product-to-image", style: "studio", aspectRatio: "16:9", resolution: "high", count: 1, scene: "premium-display", background: "luxury", lighting: "product-highlights", shadow: "soft", reflection: "gloss" }))[0];
      if (!image) throw new Error("Commercial key image generation returned no asset"); job.keyImageId = image.id;
      const video = await this.generateVideo(job, product.category, strategy);
      job.videoPackageId = video.id; job.subtitleFileName = video.subtitleFileName; job.exportFileName = await this.exportVideo(job.projectId, video); job.status = "completed"; job.completedAt = new Date().toISOString();
    } catch (error) { job.status = "failed"; job.error = error instanceof Error ? error.message : String(error); }
    job.updatedAt = new Date().toISOString(); await this.persist();
  }

  private async generateVideo(job: CommercialVideoJob, category: string, strategy: Awaited<ReturnType<MarketingIntelligenceManager["analyze"]>>): Promise<GeneratedVideoPackage> {
    let failure: unknown;
    for (let attempt = 1; attempt <= job.request.maxAttempts; attempt++) {
      job.attempts++;
      try {
        const packageResult = await this.videos.generate({ projectId: job.projectId, prompt: `${job.request.format} for ${category}, ${strategy.valueProposition}, ${strategy.brand.consistency}, cinematic story: ${job.storyboard.map((scene) => `${scene.kind} ${scene.narration}`).join("; ")}`, mode: "marketing-video", imageId: job.keyImageId, durationSeconds: job.request.durationSeconds, resolution: "1080p", frameRate: 30, voice: "narrator", music: "uplifting", soundEffects: true, subtitles: true, scene: "premium-display", camera: job.storyboard[2]?.camera ?? "hero-shot", animation: job.storyboard[2]?.animation ?? "feature-highlight", transition: "cinematic-cut", outputFormat: "mp4" });
        if (packageResult.quality.score < 80) throw new Error("Commercial video did not meet the local quality threshold"); return packageResult;
      } catch (error) { failure = error; }
    }
    throw failure instanceof Error ? failure : new Error(String(failure));
  }

  private async exportVideo(projectId: string, packageResult: GeneratedVideoPackage): Promise<string> {
    const source = await this.videos.getAssetPath(packageResult.id, "preview"); if (!source) throw new Error("Commercial video artifact is unavailable for review");
    const mimeType = packageResult.previewFileName.endsWith(".webm") ? "video/webm" : "video/mp4"; const format: ExportFormat = mimeType === "video/webm" ? "webm" : "mp4"; const name = `Commercial ${packageResult.name}`;
    const state = await this.review.getProjectState(projectId); let asset = state.assets.find((candidate) => candidate.name === name);
    if (!asset) asset = await this.review.ingestAsset(projectId, { name, mimeType, dataBase64: (await fs.readFile(source)).toString("base64") });
    if (!asset.approved) await this.review.approve(projectId, asset.id);
    return (await this.review.exportAsset(projectId, asset.id, { format, platform: jobPlatform(packageResult.mode), resolution: packageResult.resolution, quality: "high" })).fileName;
  }

  private async readStore(): Promise<Store> { try { const value = JSON.parse(await fs.readFile(path.join(this.root, "jobs.json"), "utf8")) as Partial<Store>; return { jobs: value.jobs ?? [] }; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { jobs: [] }; throw error; } }
  private async persist(): Promise<void> { const target = path.join(this.root, "jobs.json"); const temporary = `${target}.${randomUUID()}.tmp`; await fs.writeFile(temporary, `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); await fs.rename(temporary, target); }
  private ensureReady(): void { if (!this.root) throw new Error("Commercial Video Manager is not initialized"); }
}

function normalize(input: CommercialVideoRequest): Required<Omit<CommercialVideoRequest, "projectId">> { const durationSeconds = input.durationSeconds ?? defaultDuration(input.format ?? "product-commercial"); if (!Number.isInteger(durationSeconds) || durationSeconds < 3 || durationSeconds > 60) throw new Error("Commercial duration must be between 3 and 60 seconds"); return { format: input.format ?? "product-commercial", language: input.language ?? "en", durationSeconds, maxAttempts: input.maxAttempts ?? 2 }; }
function defaultDuration(format: CommercialFormat): number { return ["tiktok", "instagram-reel", "youtube-short"].includes(format) ? 15 : format === "tv-commercial" ? 30 : 20; }
function storyboard(product: string, cta: string, language: "en" | "rw"): CommercialScene[] { const words = language === "rw" ? { opening: `Menya ${product}`, intro: `${product} igenewe ubuzima bwawe`, hero: `Reba ubwiza bwa ${product}`, features: "Menya ibyiza byayo", lifestyle: "Ijye mu buzima bwawe", brand: "Kwamamaza kwizewe", offer: "Kwamamaza kw'igihe gito", cta: cta || "Menya byinshi" } : { opening: `Meet ${product}`, intro: `${product} built for everyday value`, hero: `See ${product} in its best light`, features: "Discover the details that matter", lifestyle: "Made for the moments that move you", brand: "A brand you can trust", offer: "A campaign offer worth acting on", cta: cta || "Learn more" };
  return [{ order: 1, kind: "opening", camera: "dolly", animation: "reveal", narration: words.opening }, { order: 2, kind: "introduction", camera: "tracking", animation: "smooth-motion", narration: words.intro }, { order: 3, kind: "hero", camera: "hero-shot", animation: "rotation", narration: words.hero }, { order: 4, kind: "features", camera: "macro", animation: "feature-highlight", narration: words.features }, { order: 5, kind: "lifestyle", camera: "orbit", animation: "floating", narration: words.lifestyle }, { order: 6, kind: "branding", camera: "pan", animation: "reveal", narration: words.brand }, { order: 7, kind: "offer", camera: "zoom", animation: "dynamic-motion", narration: words.offer }, { order: 8, kind: "cta", camera: "hero-shot", animation: "feature-highlight", narration: words.cta }]; }
function jobPlatform(_mode: GeneratedVideoPackage["mode"]): string { return "commercial"; }