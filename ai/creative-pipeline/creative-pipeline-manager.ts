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
import type { ImageGenerationManager } from "../image-generation/image-generation-manager.js";
import type { VideoAudioGenerationManager } from "../video-audio-generation/video-audio-generation-manager.js";
import type { ProductAssetPreparationManager } from "../product-asset-preparation/product-asset-preparation-manager.js";
import type { ProductScenePlanningManager } from "../product-scene-planning/product-scene-planning-manager.js";
import type { ProductStoryboardManager } from "../product-storyboard/product-storyboard-manager.js";
import type { ProductPromptOrchestrationManager } from "../product-prompt-orchestration/product-prompt-orchestration-manager.js";
import type { ProductImageGenerationManager } from "../product-image-generation/product-image-generation-manager.js";
import type { ProductVideoGenerationManager } from "../product-video-generation/product-video-generation-manager.js";
import type { ProductAudioGenerationManager } from "../product-audio-generation/product-audio-generation-manager.js";
import type { ProductRenderingExportManager } from "../product-rendering-export/product-rendering-export-manager.js";

export type PipelineStage = "validation" | "analysis" | "asset-preparation" | "scene-planning" | "storyboard" | "planning" | "prompt-generation" | "generation" | "rendering" | "review" | "export" | "completed" | "failed" | "paused" | "cancelled";
export type PipelineJobStatus = "queued" | "running" | "paused" | "cancelled" | "completed" | "failed";

export interface PipelineJob {
  id: string;
  projectId: string;
  stage: PipelineStage;
  progress: number;
  status: PipelineJobStatus;
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

const STAGES: PipelineStage[] = ["validation", "analysis", "asset-preparation", "scene-planning", "storyboard", "planning", "prompt-generation", "generation", "rendering", "review", "export"];

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
  private imageGenerationRuntime: ImageGenerationManager | null = null;
  private videoAudioGenerationRuntime: VideoAudioGenerationManager | null = null;
  private productAssetPreparationRuntime: ProductAssetPreparationManager | null = null;
  private productScenePlanningRuntime: ProductScenePlanningManager | null = null;
  private productStoryboardRuntime: ProductStoryboardManager | null = null;
  private productPromptOrchestrationRuntime: ProductPromptOrchestrationManager | null = null;
  private productImageGenerationRuntime: ProductImageGenerationManager | null = null;
  private productVideoGenerationRuntime: ProductVideoGenerationManager | null = null;
  private productAudioGenerationRuntime: ProductAudioGenerationManager | null = null;
  private productRenderingExportRuntime: ProductRenderingExportManager | null = null;
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

  async start(projectId: string): Promise<PipelineJob> {
    this.ensureReady();
    const active = this.store.jobs.find((job) => job.projectId === projectId && (job.status === "queued" || job.status === "running" || job.status === "paused"));
    if (active) return structuredClone(active);
    const now = new Date().toISOString();
    const job: PipelineJob = { id: randomUUID(), projectId, stage: "validation", progress: 0, status: "queued", createdAt: now, updatedAt: now, retryCount: 0, notifications: [], completedStages: [] };
    this.note(job, "info", "Autonomous pipeline dispatched.");
    this.store.jobs.unshift(job);
    await this.save();
    void this.run(job.id);
    return structuredClone(job);
  }

  attachGenerationOptimization(manager: GenerationOptimizationManager): void { this.optimization = manager; }
  attachProductIntelligence(manager: ProductIntelligenceManager): void { this.productIntelligenceRuntime = manager; }
  attachImageIntelligence(manager: ImageIntelligenceManager): void { this.imageIntelligenceRuntime = manager; }
  attachMarketingIntelligence(manager: MarketingIntelligenceManager): void { this.marketingIntelligenceRuntime = manager; }
  attachDecisionIntelligence(manager: DecisionIntelligenceManager): void { this.decisionIntelligenceRuntime = manager; }
  attachLearningIntelligence(manager: AiLearningManager): void { this.learningIntelligenceRuntime = manager; }
  attachImageGeneration(manager: ImageGenerationManager): void { this.imageGenerationRuntime = manager; }
  attachVideoAudioGeneration(manager: VideoAudioGenerationManager): void { this.videoAudioGenerationRuntime = manager; }
  attachProductAssetPreparation(manager: ProductAssetPreparationManager): void { this.productAssetPreparationRuntime = manager; }
  attachProductScenePlanning(manager: ProductScenePlanningManager): void { this.productScenePlanningRuntime = manager; }
  attachProductStoryboard(manager: ProductStoryboardManager): void { this.productStoryboardRuntime = manager; }
  attachProductPromptOrchestration(manager: ProductPromptOrchestrationManager): void { this.productPromptOrchestrationRuntime = manager; }
  attachProductImageGeneration(manager: ProductImageGenerationManager): void { this.productImageGenerationRuntime = manager; }
  attachProductVideoGeneration(manager: ProductVideoGenerationManager): void { this.productVideoGenerationRuntime = manager; }
  attachProductAudioGeneration(manager: ProductAudioGenerationManager): void { this.productAudioGenerationRuntime = manager; }
  attachProductRenderingExport(manager: ProductRenderingExportManager): void { this.productRenderingExportRuntime = manager; }

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
        if (job.status === "paused" || job.status === "cancelled") {
          this.note(job, "warning", `Pipeline ${job.status} at a stage boundary.`);
          await this.save();
          return job;
        }
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

  async pause(jobId: string): Promise<PipelineJob> {
    const job = this.requireActiveJob(jobId);
    if (job.status === "queued") job.stage = "paused";
    job.status = "paused";
    this.note(job, "warning", "Pause requested; the pipeline will stop after its current stage.");
    await this.save();
    return structuredClone(job);
  }

  async resume(jobId: string): Promise<PipelineJob> {
    const job = this.requireActiveJob(jobId);
    if (job.status !== "paused") throw new Error("Only paused pipeline jobs can be resumed");
    job.status = "queued";
    job.stage = job.completedStages.at(-1) ?? "validation";
    this.note(job, "info", "Pipeline resumed from its last completed stage.");
    await this.save();
    void this.run(job.id);
    return structuredClone(job);
  }

  async cancel(jobId: string): Promise<PipelineJob> {
    const job = this.requireActiveJob(jobId);
    job.status = "cancelled";
    job.stage = "cancelled";
    job.completedAt = new Date().toISOString();
    this.note(job, "warning", "Cancellation requested; the pipeline will stop after its current stage.");
    await this.save();
    return structuredClone(job);
  }

  getJob(jobId: string): PipelineJob | null {
    const job = [...this.store.jobs, ...this.store.history].find((item) => item.id === jobId);
    return job ? structuredClone(job) : null;
  }

  getDashboard(): { jobs: PipelineJob[]; history: PipelineJob[]; monitor: Record<string, number | string>; integrations: Record<string, boolean> } {
    const usage = process.memoryUsage();
    const completed = this.store.history.length;
    const failed = [...this.store.jobs, ...this.store.history].filter((job) => job.status === "failed").length;
    return { jobs: structuredClone(this.store.jobs), history: structuredClone(this.store.history), monitor: { pipelineHealth: failed ? "warning" : "healthy", activeJobs: this.running.size, queuedJobs: this.store.jobs.filter((job) => job.status === "queued").length, memoryMb: Math.round(usage.rss / 1024 / 1024), cpuUsage: process.cpuUsage().user, successRate: completed ? Math.round((completed / (completed + failed)) * 100) : 100, estimatedCompletion: this.store.jobs.length ? "In progress" : "Idle" }, integrations: this.integrations() };
  }

  private async executeStage(job: PipelineJob, project: NonNullable<Awaited<ReturnType<CreativeWorkspaceManager["getProject"]>>>, stage: PipelineStage): Promise<void> {
    if (stage === "validation") { const result = this.workspace!.validate(project); if (!result.valid) throw new Error(result.errors.join(" ")); return; }
    if (stage === "analysis") { const imageProfiles = this.imageIntelligenceRuntime ? await this.imageIntelligenceRuntime.analyzeProject(project.id) : []; const profile = this.productIntelligenceRuntime ? await this.productIntelligenceRuntime.analyzeProductIntelligence(project.id) : null; const marketing = this.marketingIntelligenceRuntime ? await this.marketingIntelligenceRuntime.analyze(project.id) : null; this.note(job, "info", profile ? `Product Intelligence Step 1: ${imageProfiles.length} image(s) analyzed; profile ${profile.identifiedAs}; views ${profile.viewCount} (${profile.multiView.coverage}); missing angles ${profile.imageAnalysis.missingAngles.length}; ready=${profile.readyForCreativeGeneration}; originals unmodified.${marketing ? ` Marketing strategy ready at ${marketing.score}/100.` : ""}` : "Product, brand, campaign, audience, platform, and language inputs handed to planning intelligence."); return; }
    if (stage === "asset-preparation") {
      if (!this.productAssetPreparationRuntime?.isInitialized()) {
        this.note(job, "warning", "Product Asset Preparation runtime unavailable; skipping Step 2 cutouts.");
        return;
      }
      const prepared = await this.productAssetPreparationRuntime.prepareProductAssets(project.id);
      this.note(job, "info", `Product Asset Preparation Step 2: ${prepared.assets.length} transparent asset(s); BG pass ${prepared.qualitySummary.backgroundRemovalPassRate}; missing views ${prepared.missingViews.length}; originals unmodified.`);
      return;
    }
    if (stage === "scene-planning") {
      if (!this.productScenePlanningRuntime?.isInitialized()) {
        this.note(job, "warning", "Product Scene Planning runtime unavailable; skipping Step 3 scene plan.");
        return;
      }
      const scenePlan = await this.productScenePlanningRuntime.planProductScenes(project.id);
      this.note(job, "info", `Product Scene Planning Step 3: ${scenePlan.sceneCount} scene(s); flow ${scenePlan.quality.marketingFlowScore}/100; camera ${scenePlan.quality.cameraPlanningScore}/100; lighting ${scenePlan.quality.lightingPlanningScore}/100.`);
      return;
    }
    if (stage === "storyboard") {
      if (!this.productStoryboardRuntime?.isInitialized()) {
        this.note(job, "warning", "Product Storyboard runtime unavailable; skipping Step 4 storyboard/script.");
        return;
      }
      const storyboard = await this.productStoryboardRuntime.generateStoryboardAndScript(project.id);
      this.note(job, "info", `Product Storyboard Step 4: ${storyboard.totalScenes} panel(s); script ${storyboard.quality.scriptScore}/100; flow ${storyboard.quality.marketingFlowScore}/100; CTA ${storyboard.quality.ctaPlacementScore}/100.`);
      return;
    }
    if (stage === "planning") { const result = await this.planning!.createPlan(project, this.workspace!.validate(project)); if (!result.plan) throw new Error("Creative planning could not be completed"); return; }
    if (stage === "prompt-generation") {
      if (!this.productPromptOrchestrationRuntime?.isInitialized()) {
        this.note(job, "warning", "Product Prompt Orchestration runtime unavailable; falling back to creative planning prompts.");
        const result = await this.planning!.createPlan(project, this.workspace!.validate(project));
        if (!result.plan) throw new Error("Creative planning could not be completed");
        return;
      }
      const orchestration = await this.productPromptOrchestrationRuntime.orchestratePromptsAndModels(project.id);
      this.note(job, "info", `Prompt Orchestration Step 5: ${orchestration.scenePromptSets.length} scene prompt set(s); models ${orchestration.modelSelections.length}; plan tasks ${orchestration.executionPlan.tasks.length}; quality ${orchestration.quality.overall}/100; image generation deferred.`);
      return;
    }
    if (stage === "generation") {
      if (this.productImageGenerationRuntime?.isInitialized()) {
        const sceneImages = await this.productImageGenerationRuntime.generateProductSceneImages(project.id);
        this.note(job, "info", `Product Image Generation Step 6: ${sceneImages.images.length} scene still(s); quality ${sceneImages.quality.overall}/100; product preservation ${sceneImages.quality.productPreservationScore}/100.`);
        if (this.productVideoGenerationRuntime?.isInitialized()) {
          const sceneVideos = await this.productVideoGenerationRuntime.generateProductSceneVideos(project.id);
          this.note(job, "info", `Product Video Generation Step 7: ${sceneVideos.clips.length} clip(s); ${sceneVideos.totalDurationSeconds}s; quality ${sceneVideos.quality.overall}/100.`);
          if (this.productAudioGenerationRuntime?.isInitialized()) {
            const audio = await this.productAudioGenerationRuntime.generateProductAudio(project.id);
            this.note(job, "info", `Product Audio Generation Step 8: voice=${audio.voice.persona}; music=${audio.music.style}; fx=${audio.soundEffects.length}; sync=${audio.quality.synchronizationScore}/100; rendering deferred.`);
          } else {
            this.note(job, "info", "Product Audio Generation runtime unavailable; audio/voice deferred after Step 7 video.");
          }
        } else {
          this.note(job, "info", "Product Video Generation runtime unavailable; video deferred after Step 6 stills.");
        }
        return;
      }
      if (!this.imageGenerationRuntime || !this.videoAudioGenerationRuntime) {
        this.note(job, "warning", "Generation runtimes are not attached; source-media review fallback remains active.");
        return;
      }
      const imageDefaults = await this.imageGenerationRuntime.defaultRequest(project.id);
      const images = await this.imageGenerationRuntime.generate({
        projectId: project.id,
        prompt: imageDefaults.prompt ?? `${project.productInformation.name} product composition`,
        mode: imageDefaults.mode ?? "product-to-image",
        style: imageDefaults.style ?? "studio",
        aspectRatio: imageDefaults.aspectRatio ?? "1:1",
        resolution: imageDefaults.resolution ?? "high",
        count: 1,
        productImageId: imageDefaults.productImageId,
      });
      const videoDefaults = await this.videoAudioGenerationRuntime.defaultRequest(project.id);
      const video = await this.videoAudioGenerationRuntime.generate({
        projectId: project.id,
        prompt: videoDefaults.prompt ?? `${project.productInformation.name} marketing video`,
        mode: videoDefaults.mode ?? "image-to-video",
        imageId: images[0]?.id ?? videoDefaults.imageId,
        durationSeconds: videoDefaults.durationSeconds ?? 15,
        resolution: videoDefaults.resolution ?? "1080p",
        frameRate: videoDefaults.frameRate ?? 30,
        voice: videoDefaults.voice ?? "narrator",
        music: videoDefaults.music ?? "uplifting",
        soundEffects: videoDefaults.soundEffects ?? true,
        subtitles: videoDefaults.subtitles ?? true,
      });
      this.note(job, "info", `Generated ${images.length} image preview(s) and video package ${video.id}.`);
      return;
    }
    if (stage === "rendering") {
      if (this.productRenderingExportRuntime?.isInitialized()) {
        const delivery = await this.productRenderingExportRuntime.renderAndPackage(project.id);
        const previewAbs = await this.productRenderingExportRuntime.getArtifactAbsolutePath(delivery.artifacts.previewRelativePath);
        if (previewAbs) {
          const reviewState = await this.review!.getProjectState(project.id);
          const assetName = `${project.name} delivery v${delivery.version}`;
          if (!reviewState.assets.some((asset) => asset.name === assetName)) {
            await this.review!.ingestAsset(project.id, {
              name: assetName,
              mimeType: "image/svg+xml",
              dataBase64: (await fs.readFile(previewAbs)).toString("base64"),
            });
          }
        }
        this.note(job, "info", `Product Rendering Step 9: package v${delivery.version}; platforms ${delivery.platforms.length}; quality ${delivery.quality.overall}/100; certification deferred.`);
        return;
      }
      if (!this.videoAudioGenerationRuntime) {
        this.note(job, "warning", "Video/audio runtime is not attached; source-media review fallback remains active.");
        return;
      }
      const packageResult = (await this.videoAudioGenerationRuntime.getDashboard(project.id)).packages[0];
      if (!packageResult) throw new Error("No generated video package is available for rendering");
      const previewPath = await this.videoAudioGenerationRuntime.getAssetPath(packageResult.id, "preview");
      if (!previewPath) throw new Error("Generated video package preview artifact is unavailable");
      const reviewState = await this.review!.getProjectState(project.id);
      if (!reviewState.assets.some((asset) => asset.name === packageResult.name)) {
        await this.review!.ingestAsset(project.id, {
          name: packageResult.name,
          mimeType: mimeTypeForPreview(packageResult.previewFileName),
          dataBase64: (await fs.readFile(previewPath)).toString("base64"),
        });
      }
      this.note(job, "info", `Rendered video artifact from package ${packageResult.id} into review.`);
      return;
    }
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
      if (this.productRenderingExportRuntime?.isInitialized()) {
        const delivery = (await this.productRenderingExportRuntime.getRender(project.id))
          ?? (await this.productRenderingExportRuntime.renderAndPackage(project.id));
        this.note(job, "info", `Product Export Step 9: delivery v${delivery.version} ready (${delivery.settings.format}/${delivery.settings.platform}); manifest ${delivery.artifacts.projectManifestRelativePath}.`);
        const reviewState = await this.review!.getProjectState(project.id);
        const asset = reviewState.assets.find((item) => item.approved) ?? reviewState.assets[0];
        if (asset && !asset.approved) await this.review!.approve(project.id, asset.id);
        return;
      }
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
  private requireActiveJob(id: string): PipelineJob { const job = this.requireJob(id); if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") throw new Error("Pipeline job is no longer active"); return job; }
  private integrations(): Record<string, boolean> { return { aiCore: Boolean(this.core), moduleManager: Boolean(this.core?.moduleManager), stateManager: Boolean(this.core?.stateManager), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), decisionFoundation: Boolean(this.core?.decisionEngine), decisionIntelligenceRuntime: Boolean(this.decisionIntelligenceRuntime?.isInitialized()), learningIntelligenceRuntime: Boolean(this.learningIntelligenceRuntime?.isInitialized()), productIntelligence: Boolean(this.core?.productIntelligenceFoundation), productIntelligenceRuntime: Boolean(this.productIntelligenceRuntime?.isInitialized()), imageIntelligence: Boolean(this.core?.imageIntelligenceFoundation), imageIntelligenceRuntime: Boolean(this.imageIntelligenceRuntime?.isInitialized()), marketingIntelligenceRuntime: Boolean(this.marketingIntelligenceRuntime?.isInitialized()), videoIntelligence: Boolean(this.core?.videoIntelligenceFoundation), modelManagement: Boolean(this.core?.modelManager), imageGeneration: Boolean(this.imageGenerationRuntime), videoAudioGeneration: Boolean(this.videoAudioGenerationRuntime), generationOptimization: Boolean(this.optimization?.isInitialized()), generationManager: Boolean(this.imageGenerationRuntime || this.videoAudioGenerationRuntime), productAssetPreparationRuntime: Boolean(this.productAssetPreparationRuntime?.isInitialized()), productScenePlanningRuntime: Boolean(this.productScenePlanningRuntime?.isInitialized()), productStoryboardRuntime: Boolean(this.productStoryboardRuntime?.isInitialized()), productPromptOrchestrationRuntime: Boolean(this.productPromptOrchestrationRuntime?.isInitialized()), renderingPipeline: Boolean(this.videoAudioGenerationRuntime), previewSystem: Boolean(this.review), exportSystem: Boolean(this.review) }; }
  private async readStore(): Promise<PipelineStore> { try { return JSON.parse(await fs.readFile(path.join(this.root, "pipeline.json"), "utf8")) as PipelineStore; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { jobs: [], history: [] }; throw error; } }
  private async save(): Promise<void> { const target = path.join(this.root, "pipeline.json"); const temporary = `${target}.${randomUUID()}.tmp`; await fs.writeFile(temporary, `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); await fs.rename(temporary, target); }
  private ensureReady(): void { if (!this.root || !this.workspace || !this.planning || !this.review) throw new Error("Creative Pipeline Manager is not initialized"); }
}

function formatFor(mimeType: string): ExportFormat | null { return ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "audio/mpeg": "mp3", "audio/wav": "wav" } as Record<string, ExportFormat>)[mimeType] ?? null; }

function mimeTypeForPreview(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  return extension === ".webm" ? "video/webm" : extension === ".mov" ? "video/quicktime" : "video/mp4";
}