import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { CreativePlanningManager } from "../creative-planning/creative-planning-manager.js";
import { CreativeReviewManager, type ExportFormat } from "../creative-review/creative-review-manager.js";
import { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { GenerationOptimizationManager } from "../generation-optimization/generation-optimization-manager.js";
import type { ProductIntelligenceManager } from "../product-intelligence/product-intelligence-manager.js";
import type { ImageIntelligenceManager } from "../image-intelligence/image-intelligence-manager.js";
import type { MarketingIntelligenceManager } from "../marketing-intelligence/marketing-intelligence-manager.js";
import type { DecisionIntelligenceManager } from "../decision-intelligence/decision-intelligence-manager.js";
import type { AiLearningManager } from "../learning-intelligence/learning-intelligence-manager.js";

export type PipelineStage = "validation" | "analysis" | "planning" | "prompt-generation" | "generation" | "rendering" | "review" | "export" | "completed" | "failed";

export interface PipelineJob {
  id: string;
  projectId: string;
  stage: PipelineStage;
  progress: number;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  error?: string;
  notifications: Array<{ at: string; level: "info" | "warning" | "error"; message: string }>;
  completedStages: PipelineStage[];
}

interface PipelineStore { jobs: PipelineJob[]; history: PipelineJob[]; }

const STAGES: PipelineStage[] = ["validation", "analysis", "planning", "prompt-generation", "generation", "rendering", "review", "export"];

/** Coordinates the existing creative modules; it does not replace generation or rendering engines. */
export class CreativePipelineManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private workspace: CreativeWorkspaceManager | null = null;
  private planning: CreativePlanningManager | null = null;
  private review: CreativeReviewManager | null = null;
  private optimization: GenerationOptimizationManager | null = null;
  private productIntelligenceRuntime: ProductIntelligenceManager | null = null;
  private imageIntelligenceRuntime: ImageIntelligenceManager | null = null;
  private marketingIntelligenceRuntime: MarketingIntelligenceManager | null = null;
  private decisionIntelligenceRuntime: DecisionIntelligenceManager | null = null;
  private learningIntelligenceRuntime: AiLearningManager | null = null;
  private store: PipelineStore = { jobs: [], history: [] };
  private running = new Set<string>();

  async initialize(storageRoot: string, dependencies: { core: AiCoreManager; workspace: CreativeWorkspaceManager; planning: CreativePlanningManager; review: CreativeReviewManager }): Promise<void> {
    this.root = path.join(storageRoot, "creative-pipeline");
    this.core = dependencies.core; this.workspace = dependencies.workspace; this.planning = dependencies.planning; this.review = dependencies.review;
    await fs.mkdir(this.root, { recursive: true });
    this.store = await this.readStore();
    for (const job of this.store.jobs.filter((item) => item.status === "queued" || item.status === "running")) {
      job.status = "queued";
      this.note(job, "warning", "Pipeline resumed after interruption from the last checkpoint.");
      void this.run(job.id);
    }
    await this.save();
  }

  async enqueue(projectId: string): Promise<PipelineJob> {
    this.ensureReady();
    const active = this.store.jobs.find((job) => job.projectId === projectId && (job.status === "queued" || job.status === "running"));
    if (active) return active;
    const now = new Date().toISOString();
    const job: PipelineJob = { id: randomUUID(), projectId, stage: "validation", progress: 0, status: "queued", createdAt: now, updatedAt: now, retryCount: 0, notifications: [], completedStages: [] };
    this.note(job, "info", "Pipeline queued for automatic execution.");
    this.store.jobs.unshift(job);
    await this.save();
    await this.run(job.id);
    return job;
  }

  attachGenerationOptimization(manager: GenerationOptimizationManager): void { this.optimization = manager; }
  attachProductIntelligence(manager: ProductIntelligenceManager): void { this.productIntelligenceRuntime = manager; }
  attachImageIntelligence(manager: ImageIntelligenceManager): void { this.imageIntelligenceRuntime = manager; }
  attachMarketingIntelligence(manager: MarketingIntelligenceManager): void { this.marketingIntelligenceRuntime = manager; }
  attachDecisionIntelligence(manager: DecisionIntelligenceManager): void { this.decisionIntelligenceRuntime = manager; }
  attachLearningIntelligence(manager: AiLearningManager): void { this.learningIntelligenceRuntime = manager; }

  async run(jobId: string): Promise<PipelineJob> {
    this.ensureReady();
    const job = this.requireJob(jobId);
    if (this.running.has(jobId) || job.status === "completed") return job;
    this.running.add(jobId);
    job.status = "running"; job.startedAt ??= new Date().toISOString();
    try {
      const project = await this.workspace!.getProject(job.projectId);
      if (!project) throw new Error("Project no longer exists");
      if (this.decisionIntelligenceRuntime) {
        const decision = await this.decisionIntelligenceRuntime.decide(project.id, "pipeline");
        this.note(job, "info", `Decision Intelligence selected ${decision.selected.label} at ${decision.confidence}% confidence.`);
      }
      for (const stage of STAGES) {
        if (job.completedStages.includes(stage)) continue;
        job.stage = stage; job.updatedAt = new Date().toISOString(); await this.save();
        await this.executeStage(job, project, stage);
        job.completedStages.push(stage); job.progress = Math.round((job.completedStages.length / STAGES.length) * 100);
        this.note(job, "info", `${stage.replace(/-/g, " ")} completed.`);
        await this.save();
      }
      job.stage = "completed"; job.status = "completed"; job.progress = 100; job.completedAt = new Date().toISOString();
      this.note(job, "info", "Creative pipeline completed and project export saved.");
      this.store.jobs = this.store.jobs.filter((item) => item.id !== job.id);
      this.store.history.unshift(structuredClone(job));
      await this.learningIntelligenceRuntime?.learnFromProject(project.id, "success");
      await this.save();
    } catch (error) {
      job.retryCount += 1; job.status = "failed"; job.stage = "failed"; job.error = error instanceof Error ? error.message : String(error);
      this.note(job, "error", `Pipeline paused: ${job.error}`);
      await this.learningIntelligenceRuntime?.learnFromProject(job.projectId, "failure", job.error);
      await this.save();
    } finally { this.running.delete(jobId); }
    return job;
  }

  async retry(jobId: string): Promise<PipelineJob> {
    const job = this.requireJob(jobId);
    job.status = "queued"; job.stage = job.completedStages.at(-1) ?? "validation"; job.error = undefined;
    this.note(job, "warning", "Retry requested; resuming from the last completed stage.");
    await this.save();
    return this.run(jobId);
  }

  getDashboard(): { jobs: PipelineJob[]; history: PipelineJob[]; monitor: Record<string, number | string>; integrations: Record<string, boolean> } {
    const usage = process.memoryUsage();
    const completed = this.store.history.length;
    const failed = [...this.store.jobs, ...this.store.history].filter((job) => job.status === "failed").length;
    return { jobs: structuredClone(this.store.jobs), history: structuredClone(this.store.history), monitor: { pipelineHealth: failed ? "warning" : "healthy", activeJobs: this.running.size, queuedJobs: this.store.jobs.filter((job) => job.status === "queued").length, memoryMb: Math.round(usage.rss / 1024 / 1024), cpuUsage: process.cpuUsage().user, successRate: completed ? Math.round((completed / (completed + failed)) * 100) : 100, estimatedCompletion: this.store.jobs.length ? "In progress" : "Idle" }, integrations: this.integrations() };
  }

  private async executeStage(job: PipelineJob, project: NonNullable<Awaited<ReturnType<CreativeWorkspaceManager["getProject"]>>>, stage: PipelineStage): Promise<void> {
    if (stage === "validation") { const result = this.workspace!.validate(project); if (!result.valid) throw new Error(result.errors.join(" ")); return; }
    if (stage === "analysis") { const imageProfiles = this.imageIntelligenceRuntime ? await this.imageIntelligenceRuntime.analyzeProject(project.id) : []; const profile = this.productIntelligenceRuntime ? await this.productIntelligenceRuntime.analyze(project.id) : null; const marketing = this.marketingIntelligenceRuntime ? await this.marketingIntelligenceRuntime.analyze(project.id) : null; this.note(job, "info", profile ? `Image intelligence analyzed ${imageProfiles.length} uploaded image(s); product profile ready: ${profile.identifiedAs}, ${profile.viewCount} view(s), quality ${profile.quality.score}/100.${marketing ? ` Marketing strategy ready at ${marketing.score}/100.` : ""}` : "Product, brand, campaign, audience, platform, and language inputs handed to planning intelligence."); return; }
    if (stage === "planning" || stage === "prompt-generation") { const result = await this.planning!.createPlan(project, this.workspace!.validate(project)); if (!result.plan) throw new Error("Creative planning could not be completed"); return; }
    if (stage === "generation") { this.note(job, "info", "Generation manager handoff prepared; registered generated assets will be picked up by the review artifact bridge."); return; }
    if (stage === "rendering") { this.note(job, "info", "Rendering pipeline handoff prepared; source artifact fallback is enabled until a rendered artifact is registered."); return; }
    if (stage === "review") {
      const reviewState = await this.review!.getProjectState(project.id);
      if (!reviewState.assets.length) {
        const images = await Promise.all(project.productImages.map(async (image) => {
          const imagePath = await this.workspace!.getImagePath(project.id, image.url.split("/").pop() ?? "");
          return imagePath ? { name: image.fileName, mimeType: image.mimeType, dataBase64: (await fs.readFile(imagePath)).toString("base64") } : null;
        }));
        await this.review!.bootstrapProductImages(project, images.filter((image): image is NonNullable<typeof image> => image !== null));
      }
      const asset = (await this.review!.getProjectState(project.id)).assets[0];
      if (!asset) throw new Error("No generated or source media artifact is available for review");
      if (!asset.approved) await this.review!.approve(project.id, asset.id);
      return;
    }
    if (stage === "export") {
      const reviewState = await this.review!.getProjectState(project.id);
      const asset = reviewState.assets.find((item) => item.approved);
      if (!asset) throw new Error("No approved artifact is available for export");
      const format = formatFor(asset.mimeType);
      if (!format) throw new Error("Approved artifact does not have a supported export format");
      await this.review!.exportAsset(project.id, asset.id, { format, platform: project.platform, resolution: "source", quality: "high" });
    }
  }

  private note(job: PipelineJob, level: "info" | "warning" | "error", message: string): void { job.notifications.unshift({ at: new Date().toISOString(), level, message }); job.updatedAt = new Date().toISOString(); }
  private requireJob(id: string): PipelineJob { const job = this.store.jobs.find((item) => item.id === id); if (!job) throw new Error("Pipeline job not found"); return job; }
  private integrations(): Record<string, boolean> { return { aiCore: Boolean(this.core), moduleManager: Boolean(this.core?.moduleManager), stateManager: Boolean(this.core?.stateManager), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), decisionFoundation: Boolean(this.core?.decisionEngine), decisionIntelligenceRuntime: Boolean(this.decisionIntelligenceRuntime?.isInitialized()), learningIntelligenceRuntime: Boolean(this.learningIntelligenceRuntime?.isInitialized()), productIntelligence: Boolean(this.core?.productIntelligenceFoundation), productIntelligenceRuntime: Boolean(this.productIntelligenceRuntime?.isInitialized()), imageIntelligence: Boolean(this.core?.imageIntelligenceFoundation), imageIntelligenceRuntime: Boolean(this.imageIntelligenceRuntime?.isInitialized()), marketingIntelligenceRuntime: Boolean(this.marketingIntelligenceRuntime?.isInitialized()), videoIntelligence: Boolean(this.core?.videoIntelligenceFoundation), modelManagement: Boolean(this.core?.modelManager), imageGeneration: Boolean(this.core?.imageGenerationFoundation), videoAudioGeneration: Boolean(this.core?.videoGenerationFoundation && this.core?.audioGenerationFoundation), generationOptimization: Boolean(this.optimization?.isInitialized()), generationManager: Boolean(this.core?.imageGenerationFoundation || this.core?.videoGenerationFoundation || this.core?.audioGenerationFoundation), renderingPipeline: Boolean(this.core?.videoGenerationFoundation), previewSystem: Boolean(this.review), exportSystem: Boolean(this.review) }; }
  private async readStore(): Promise<PipelineStore> { try { return JSON.parse(await fs.readFile(path.join(this.root, "pipeline.json"), "utf8")) as PipelineStore; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { jobs: [], history: [] }; throw error; } }
  private async save(): Promise<void> { await fs.writeFile(path.join(this.root, "pipeline.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); }
  private ensureReady(): void { if (!this.root || !this.workspace || !this.planning || !this.review) throw new Error("Creative Pipeline Manager is not initialized"); }
}

function formatFor(mimeType: string): ExportFormat | null { return ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "audio/mpeg": "mp3", "audio/wav": "wav" } as Record<string, ExportFormat>)[mimeType] ?? null; }