import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveProductionImagePath } from "../media-intelligence/asset-resolver.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import type { CreativePlanningManager } from "../creative-planning/creative-planning-manager.js";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import {
  concatClips,
  ffmpegAvailable,
  ffprobeAvailable,
  probeVideo,
  renderStillClip,
  resolveFontFile,
} from "./ffmpeg-renderer.js";
import {
  buildRenderPlan,
  buildRenderPlanForProfile,
  buildTimelineFromPlan,
  rebindCreativePlanScenes,
  sliceTimelineForRender,
  timelineDurationMs,
} from "./plan-to-timeline.js";
import { computeOutputStatus, timelineFingerprint, timelineUsesStaleAssets, uniqueAssetIds } from "./output-stale.js";
import { profileForPlatform, type VideoPlatformProfile } from "./platform-profiles.js";
import { validateBeforeRender, validateRenderedOutput } from "./render-validation.js";
import {
  VIDEO_PRODUCTION_VERSION,
  VideoProductionError,
  type VideoAspectRatio,
  type VideoCameraId,
  type VideoMotionId,
  type VideoOutputDetails,
  type VideoPlatformId,
  type VideoProject,
  type VideoRenderJob,
  type VideoRenderValidation,
  type VideoTextOverlayStatus,
  type VideoTimelineClip,
  type VideoTransitionId,
  type VideoVersion,
} from "./types.js";
import { isEquivalentKnowledgeMessage } from "../product-intelligence/normalize-profile.js";
import { recordVideoProductionFoundation } from "./video-production-foundation.js";

const PROVIDER_MESSAGE = "VIDEO GENERATION PROVIDER UNAVAILABLE. Deterministic FFmpeg still-to-video remains available.";
const AUDIO_MESSAGE = "No audio generation provider is configured. Video will render without audio.";

export class VideoProductionManager {
  private root = "";
  private core: AiCoreManager | null = null;
  private workspace: CreativeWorkspaceManager | null = null;
  private planning: CreativePlanningManager | null = null;
  private rendering = false;
  private draining = false;

  async initialize(
    storageRoot: string,
    deps: { core?: AiCoreManager; workspace: CreativeWorkspaceManager; planning: CreativePlanningManager },
  ): Promise<void> {
    this.root = path.join(storageRoot, "video-production");
    this.core = deps.core ?? null;
    this.workspace = deps.workspace;
    this.planning = deps.planning;
    await fs.mkdir(path.join(this.root, "projects"), { recursive: true });
    await fs.mkdir(path.join(this.root, "jobs"), { recursive: true });
    await fs.mkdir(path.join(this.root, "tmp"), { recursive: true });
    await this.failInterruptedJobs();
  }

  isInitialized(): boolean {
    return Boolean(this.root && this.workspace && this.planning);
  }

  async getVideoProject(projectId: string): Promise<VideoProject | null> {
    this.ensureInitialized();
    const video = await this.readJson<VideoProject | null>(this.projectFile(projectId), null);
    if (!video) return null;
    const staleEquivalent =
      (video.knowledgeStatus === "error" || video.knowledgeStatus === "failed") &&
      isEquivalentKnowledgeMessage(video.knowledgeMessage);
    if (!staleEquivalent) return this.decorateVideo(video);
    const workspaceProject = await this.workspace!.getProject(projectId);
    if (!workspaceProject) return video;
    try {
      const foundation = await recordVideoProductionFoundation(this.core, workspaceProject, video);
      const repaired: VideoProject = { ...video, ...foundation, modifiedAt: new Date().toISOString() };
      await this.writeJson(this.projectFile(projectId), repaired);
      return this.decorateVideo(repaired);
    } catch {
      return this.decorateVideo(video);
    }
  }

  async validateRender(projectId: string, preset: "preview" | "standard" = "standard"): Promise<VideoRenderValidation> {
    this.ensureInitialized();
    const video = await this.ensureFreshVideoProject(projectId);
    const workspaceProject = await this.workspace!.getProject(projectId);
    if (!workspaceProject) throw new VideoProductionError("PROJECT_NOT_FOUND", "Project not found", 404);
    const profile = profileForPlatform(video.platform ?? workspaceProject.platform);
    const renderClips = sliceTimelineForRender(video.timeline, preset);
    const assetChecks = await Promise.all(renderClips.map(async (clip) => ({
      assetId: clip.assetId,
      available: Boolean(await resolveProductionImagePath(this.workspace!, projectId, clip.assetId)),
    })));
    return validateBeforeRender({
      video,
      project: workspaceProject,
      profile,
      preset,
      renderClips,
      assetsAvailable: (assetId) => assetChecks.find((item) => item.assetId === assetId)?.available ?? false,
    });
  }

  /** Rebuild timeline and repair plan bindings when stored asset IDs no longer exist on the project. */
  private async ensureFreshVideoProject(projectId: string): Promise<VideoProject> {
    const workspaceProject = await this.workspace!.getProject(projectId);
    if (!workspaceProject) throw new VideoProductionError("PROJECT_NOT_FOUND", "Project not found", 404);
    let video = await this.getVideoProject(projectId);
    const stale = !video?.timeline?.length
      || timelineUsesStaleAssets(workspaceProject.productImages, video.timeline);
    if (!video || stale) {
      video = await this.createOrRefresh(projectId, { preserveEdits: true });
    }
    return video;
  }

  async getOutputDetails(projectId: string): Promise<VideoOutputDetails | null> {
    this.ensureInitialized();
    const video = await this.getVideoProject(projectId);
    if (!video?.output) return null;
    const profile = video.platform ? profileForPlatform(video.platform) : null;
    return {
      assetId: video.output.assetId,
      url: video.output.url,
      mimeType: "video/mp4",
      width: video.output.width,
      height: video.output.height,
      durationMs: video.output.durationMs,
      sizeBytes: video.output.sizeBytes,
      platform: video.output.platform ?? video.platform,
      platformLabel: profile?.label,
      preset: video.output.preset,
      renderJobId: video.output.renderJobId,
      createdAt: video.output.createdAt,
      outputStatus: video.outputStatus ?? "NONE",
      validationStatus: video.output.validationStatus === "TECHNICALLY_VALIDATED"
        ? "TECHNICALLY_VALIDATED"
        : video.output.validationStatus === "FAILED"
          ? "FAILED"
          : "NONE",
      validationChecks: video.outputValidation,
      creativePlanId: video.creativePlanId,
      creativePlanVersion: video.creativePlanVersion,
      manifestId: video.manifestId,
      sceneCount: video.timeline.length,
      sourceAssetIds: uniqueAssetIds(video.timeline),
      textOverlay: video.textOverlay,
    };
  }

  async getJob(jobId: string, projectId?: string): Promise<VideoRenderJob | null> {
    this.ensureInitialized();
    if (!jobId) return null;
    const job = await this.readJson<VideoRenderJob | null>(this.jobFile(jobId), null);
    if (!job) return null;
    if (projectId && job.projectId !== projectId) return null;
    return job;
  }

  async createOrRefresh(projectId: string, options?: { preserveEdits?: boolean }): Promise<VideoProject> {
    this.ensureInitialized();
    const workspaceProject = await this.workspace!.getProject(projectId);
    if (!workspaceProject) throw new VideoProductionError("PROJECT_NOT_FOUND", "Project not found", 404);
    const plan = await this.planning!.getPlan(projectId);
    if (!plan) throw new VideoProductionError("MISSING_PLAN", "Generate a Creative Plan before creating a video project", 422);
    const repairedPlan = rebindCreativePlanScenes(workspaceProject, plan);
    if (repairedPlan !== plan) {
      await this.planning!.updatePlan(projectId, { scenes: repairedPlan.scenes });
    }
    const manifest = await this.planning!.getManifest(projectId);
    const originals = workspaceProject.productImages.filter(isOriginalProductImage);
    if (!originals.length) {
      throw new VideoProductionError("MISSING_ASSET", "At least one original product image is required", 422);
    }

    const existing = await this.getVideoProject(projectId);
    const preserve = options?.preserveEdits !== false;
    const existingClips = preserve ? existing?.timeline.filter((clip) => clip.userEdited) : undefined;
    const timeline = buildTimelineFromPlan(workspaceProject, repairedPlan, { existing: existingClips });
    if (!timeline.length) {
      throw new VideoProductionError("MISSING_ASSET", "Creative Plan scenes could not be bound to original assets", 422);
    }
    const profile = profileForPlatform(workspaceProject.platform);
    const now = new Date().toISOString();
    const renderPlan = buildRenderPlanForProfile(profile, timelineDurationMs(timeline), existing?.renderPlan.preset ?? "preview");
    const video: VideoProject = {
      id: existing?.id ?? randomUUID(),
      projectId,
      productId: repairedPlan.productId || projectId,
      creativePlanId: repairedPlan.id,
      creativePlanVersion: repairedPlan.version,
      manifestId: manifest?.manifestId ?? repairedPlan.manifestId ?? existing?.manifestId,
      platform: profile.id,
      createdAt: existing?.createdAt ?? now,
      modifiedAt: now,
      version: (existing?.version ?? 0) + 1,
      timeline,
      timelineMode: "full",
      audioPlan: {
        backgroundMusic: "none",
        voiceover: "none",
        soundEffects: "none",
        status: "UNAVAILABLE",
        message: AUDIO_MESSAGE,
      },
      renderPlan,
      renderState: existing?.renderState === "processing" || existing?.renderState === "queued"
        ? existing.renderState
        : existing?.output ? "completed" : "idle",
      activeJobId: existing?.activeJobId,
      output: existing?.output,
      outputSourceFingerprint: existing?.outputSourceFingerprint,
      outputValidation: existing?.outputValidation,
      versions: existing?.versions ?? [],
      videoGenerationProvider: "UNAVAILABLE",
      videoGenerationProviderMessage: PROVIDER_MESSAGE,
      userEdited: existing?.userEdited,
      foundationKnowledgeIds: existing?.foundationKnowledgeIds,
      textOverlay: existing?.textOverlay,
    };
    const foundation = await recordVideoProductionFoundation(this.core, workspaceProject, video);
    Object.assign(video, foundation);
    const decorated = this.decorateVideo(video);
    await this.writeJson(this.projectFile(projectId), decorated);
    return decorated;
  }

  async updateVideoProject(projectId: string, changes: {
    aspectRatio?: VideoAspectRatio;
    platform?: VideoPlatformId;
    reorder?: string[];
    clip?: {
      id: string;
      durationMs?: number;
      camera?: VideoCameraId;
      motion?: VideoMotionId;
      transitionOut?: VideoTransitionId;
      assetId?: string;
      text?: string;
    };
  }): Promise<VideoProject> {
    this.ensureInitialized();
    const video = await this.getVideoProject(projectId) ?? await this.createOrRefresh(projectId);
    const workspaceProject = await this.workspace!.getProject(projectId);
    if (!workspaceProject) throw new VideoProductionError("PROJECT_NOT_FOUND", "Project not found", 404);

    let timeline = [...video.timeline];
    if (changes.reorder?.length) {
      const ordered = changes.reorder
        .map((id, index) => {
          const clip = timeline.find((item) => item.id === id || item.sceneId === id);
          return clip ? { ...clip, order: index + 1, userEdited: true } : null;
        })
        .filter((clip): clip is VideoTimelineClip => Boolean(clip));
      if (ordered.length === timeline.length) timeline = ordered;
    }
    if (changes.clip) {
      const originals = workspaceProject.productImages.filter(isOriginalProductImage);
      timeline = timeline.map((clip) => {
        if (clip.id !== changes.clip!.id && clip.sceneId !== changes.clip!.id) return clip;
        const next = { ...clip, userEdited: true };
        if (typeof changes.clip!.durationMs === "number") {
          next.durationMs = Math.min(15000, Math.max(800, Math.round(changes.clip!.durationMs)));
        }
        if (changes.clip!.camera) next.camera = changes.clip!.camera;
        if (changes.clip!.motion) next.motion = changes.clip!.motion;
        if (changes.clip!.transitionOut) next.transitionOut = changes.clip!.transitionOut;
        if (changes.clip!.assetId) {
          if (!originals.some((image) => image.id === changes.clip!.assetId)) {
            throw new VideoProductionError("INVALID_ASSET", "Replacement asset must be an original product image", 422);
          }
          next.assetId = changes.clip!.assetId;
        }
        if (typeof changes.clip!.text === "string") {
          const content = changes.clip!.text.trim().slice(0, 80);
          next.text = content
            ? [{ content, kind: "headline", startMs: clip.startMs, durationMs: next.durationMs, position: "top" }]
            : [];
        }
        return next;
      });
    }
    timeline = recomputeStarts(timeline);
    const profile = changes.platform
      ? profileForPlatform(changes.platform)
      : video.platform
        ? profileForPlatform(video.platform)
        : profileForPlatform(workspaceProject.platform);
    const renderPlan = changes.aspectRatio
      ? buildRenderPlan(changes.aspectRatio, timelineDurationMs(timeline), video.renderPlan.preset, profile.id)
      : buildRenderPlanForProfile(profile, timelineDurationMs(timeline), video.renderPlan.preset);
    const updatedBase: VideoProject = {
      ...video,
      platform: profile.id,
      timeline,
      renderPlan,
      modifiedAt: new Date().toISOString(),
      version: video.version + 1,
      userEdited: true,
      videoGenerationProvider: "UNAVAILABLE",
      videoGenerationProviderMessage: PROVIDER_MESSAGE,
    };
    const updated = this.decorateVideo(updatedBase);
    await this.writeJson(this.projectFile(projectId), updated);
    return updated;
  }

  async startRender(projectId: string, preset: "preview" | "standard" = "preview"): Promise<{ job: VideoRenderJob; video: VideoProject }> {
    this.ensureInitialized();
    if (!(await ffmpegAvailable())) {
      throw new VideoProductionError("FFMPEG_UNAVAILABLE", "FFmpeg is not available on this host", 503);
    }
    if (!(await ffprobeAvailable())) {
      throw new VideoProductionError("FFPROBE_UNAVAILABLE", "ffprobe is not available on this host", 503);
    }
    let video = await this.ensureFreshVideoProject(projectId);
    if (video.activeJobId) {
      const active = await this.getJob(video.activeJobId);
      if (active && (active.status === "queued" || active.status === "processing")) {
        throw new VideoProductionError("RENDER_IN_PROGRESS", "A render is already running for this project", 409);
      }
    }
    if (preset === "standard" && !video.timeline.length) {
      throw new VideoProductionError("MISSING_TIMELINE", "Generate a timeline before final render", 422);
    }
    const workspaceProject = await this.workspace!.getProject(projectId);
    if (!workspaceProject) throw new VideoProductionError("PROJECT_NOT_FOUND", "Project not found", 404);
    const profile = profileForPlatform(video.platform ?? workspaceProject.platform);
    const validation = await this.validateRender(projectId, preset);
    if (!validation.ready) {
      throw new VideoProductionError("VALIDATION_FAILED", validation.issues.join(" "), 422);
    }
    video = await this.getVideoProject(projectId) ?? video;
    const renderClips = sliceTimelineForRender(video.timeline, preset);
    for (const clip of renderClips) {
      const resolved = await resolveProductionImagePath(this.workspace!, projectId, clip.assetId);
      if (!resolved?.path) {
        throw new VideoProductionError("MISSING_ASSET", `Scene ${clip.order} is missing original asset ${clip.assetId}`, 422);
      }
    }
    const now = new Date().toISOString();
    const job: VideoRenderJob = {
      id: randomUUID(),
      projectId,
      videoProjectId: video.id,
      status: "queued",
      stage: "queued",
      progress: 0,
      createdAt: now,
      updatedAt: now,
      preset,
    };
    video = {
      ...video,
      platform: profile.id,
      renderPlan: buildRenderPlanForProfile(profile, timelineDurationMs(renderClips), preset),
      renderState: "queued",
      activeJobId: job.id,
      modifiedAt: now,
    };
    await this.writeJson(this.jobFile(job.id), job);
    await this.writeJson(this.projectFile(projectId), video);
    this.scheduleDrain();
    return { job, video };
  }

  async getOutputFilePath(projectId: string): Promise<string | null> {
    const video = await this.getVideoProject(projectId);
    if (!video?.output?.assetId) return null;
    return this.workspace!.getVideoPath(projectId, `${video.output.assetId}.mp4`);
  }

  private scheduleDrain(): void {
    if (this.draining) return;
    this.draining = true;
    setImmediate(() => {
      void this.drain().finally(() => {
        this.draining = false;
      });
    });
  }

  private async drain(): Promise<void> {
    if (this.rendering) return;
    const next = await this.nextQueuedJob();
    if (!next) return;
    this.rendering = true;
    try {
      await this.processJob(next);
    } finally {
      this.rendering = false;
      const more = await this.nextQueuedJob();
      if (more) this.scheduleDrain();
    }
  }

  private async nextQueuedJob(): Promise<VideoRenderJob | null> {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(path.join(this.root, "jobs"));
    } catch {
      return null;
    }
    const jobs: VideoRenderJob[] = [];
    for (const name of entries.filter((item) => item.endsWith(".json"))) {
      const job = await this.readJson<VideoRenderJob | null>(path.join(this.root, "jobs", name), null);
      if (job?.status === "queued") jobs.push(job);
    }
    jobs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return jobs[0] ?? null;
  }

  private async processJob(job: VideoRenderJob): Promise<void> {
    const started: VideoRenderJob = {
      ...job,
      status: "processing",
      stage: "preparing",
      progress: 5,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.writeJson(this.jobFile(job.id), started);
    await this.patchVideo(job.projectId, { renderState: "processing", activeJobId: job.id });

    const tmpDir = path.join(this.root, "tmp", job.id);
    await fs.mkdir(tmpDir, { recursive: true });
    let overlay: VideoTextOverlayStatus | undefined;
    try {
      const video = await this.getVideoProject(job.projectId);
      if (!video) throw new VideoProductionError("PROJECT_NOT_FOUND", "Video project missing during render", 404);
      const preset = job.preset ?? video.renderPlan.preset ?? "preview";
      const renderClips = sliceTimelineForRender(video.timeline, preset);
      const profile = profileForPlatform(video.platform ?? "youtube");
      const renderPlan = buildRenderPlanForProfile(profile, timelineDurationMs(renderClips), preset);
      const plannedDurationMs = timelineDurationMs(renderClips);
      const fontFile = await resolveFontFile();
      const overlays: VideoTextOverlayStatus[] = [];
      const clipPaths: string[] = [];
      await this.writeJob(job.id, { ...started, stage: "rendering", progress: 10 });
      for (const [index, clip] of renderClips.entries()) {
        await yieldLoop();
        const resolved = await resolveProductionImagePath(this.workspace!, job.projectId, clip.assetId);
        const imagePath = resolved?.path ?? null;
        if (!imagePath) throw new VideoProductionError("MISSING_ASSET", `Asset ${clip.assetId} is not on disk`, 422);
        const clipPath = path.join(tmpDir, `clip-${index + 1}.mp4`);
        const rendered = await renderStillClip({ clip, imagePath }, renderPlan, clipPath, fontFile);
        overlays.push(rendered.overlay);
        clipPaths.push(clipPath);
        await this.writeJob(job.id, {
          ...started,
          stage: "rendering",
          progress: Math.min(80, 10 + Math.round(((index + 1) / renderClips.length) * 70)),
        });
      }
      await yieldLoop();
      await this.writeJob(job.id, { ...started, stage: "rendering", progress: 82 });
      const outputPath = path.join(tmpDir, "output.mp4");
      if (clipPaths.length === 1) {
        await fs.copyFile(clipPaths[0]!, outputPath);
      } else {
        await concatClips(clipPaths, outputPath, {
          x264Preset: renderPlan.x264Preset,
          crf: renderPlan.crf,
        });
      }
      await this.writeJob(job.id, { ...started, stage: "validating", progress: 88 });
      const probed = await probeVideo(outputPath);
      const qc = validateRenderedOutput({
        probed,
        plannedDurationMs,
        plannedWidth: renderPlan.width,
        plannedHeight: renderPlan.height,
        sceneCount: renderClips.length,
        preset,
      });
      if (!qc.valid) {
        throw new VideoProductionError("INVALID_OUTPUT", qc.issues.join(" "), 500);
      }
      await this.writeJob(job.id, { ...started, stage: "registering", progress: 92 });
      const parentAssetId = renderClips[0]?.assetId;
      const registered = await this.workspace!.registerOutputAsset(job.projectId, {
        sourcePath: outputPath,
        fileName: preset === "standard" ? "product-video-final.mp4" : "product-video-preview.mp4",
        mimeType: "video/mp4",
        width: probed.width,
        height: probed.height,
        sizeBytes: probed.sizeBytes,
        durationMs: probed.durationMs,
        parentAssetId,
        renderJobId: job.id,
      });
      overlay = mergeOverlay(overlays);
      const completedAt = new Date().toISOString();
      const sourceFingerprint = timelineFingerprint({ ...video, renderPlan });
      const output = {
        assetId: registered.id,
        mimeType: "video/mp4" as const,
        durationMs: probed.durationMs,
        width: probed.width,
        height: probed.height,
        sizeBytes: probed.sizeBytes,
        url: registered.url,
        renderJobId: job.id,
        createdAt: completedAt,
        preset,
        platform: profile.id,
        validationStatus: "TECHNICALLY_VALIDATED" as const,
      };
      const version: VideoVersion = {
        versionId: randomUUID(),
        renderJobId: job.id,
        preset,
        platform: profile.id,
        creativePlanId: video.creativePlanId,
        creativePlanVersion: video.creativePlanVersion,
        manifestId: video.manifestId,
        aspectRatio: renderPlan.aspectRatio,
        sceneCount: renderClips.length,
        durationMs: probed.durationMs,
        sourceFingerprint,
        output,
        createdAt: completedAt,
      };
      const completed: VideoRenderJob = {
        ...started,
        status: "completed",
        stage: "completed",
        progress: 100,
        completedAt,
        updatedAt: completedAt,
        outputPath: registered.url,
        outputAssetId: registered.id,
        textOverlay: overlay,
        preset,
      };
      const updatedVideo = this.decorateVideo({
        ...video,
        platform: profile.id,
        renderPlan,
        renderState: "completed",
        activeJobId: job.id,
        modifiedAt: completedAt,
        textOverlay: overlay,
        output,
        outputSourceFingerprint: sourceFingerprint,
        outputValidation: qc.checks,
        versions: [...(video.versions ?? []), version],
      });
      await this.writeJson(this.projectFile(job.projectId), updatedVideo);
      await this.writeJson(this.jobFile(job.id), completed);
      const workspaceProject = await this.workspace!.getProject(job.projectId);
      if (workspaceProject) {
        try {
          const foundation = await recordVideoProductionFoundation(this.core, workspaceProject, updatedVideo);
          await this.writeJson(this.projectFile(job.projectId), { ...updatedVideo, ...foundation, modifiedAt: new Date().toISOString() });
        } catch (error) {
          await this.patchVideo(job.projectId, {
            knowledgeStatus: "failed",
            knowledgeMessage: error instanceof Error ? error.message : "Knowledge integration failed",
          });
        }
      }
    } catch (error) {
      const failed: VideoRenderJob = {
        ...started,
        status: "failed",
        stage: "failed",
        progress: 0,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Render failed",
        errorCode: renderErrorCode(error),
        ffmpegExitCode: (error as { ffmpegExitCode?: number }).ffmpegExitCode,
        textOverlay: overlay,
      };
      await this.writeJson(this.jobFile(job.id), failed);
      await this.patchVideo(job.projectId, { renderState: "failed", activeJobId: job.id });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async writeJob(jobId: string, job: VideoRenderJob): Promise<void> {
    await this.writeJson(this.jobFile(jobId), { ...job, updatedAt: new Date().toISOString() });
  }

  private async patchVideo(projectId: string, patch: Partial<VideoProject>): Promise<void> {
    const video = await this.getVideoProject(projectId);
    if (!video) return;
    await this.writeJson(this.projectFile(projectId), { ...video, ...patch, modifiedAt: new Date().toISOString() });
  }

  private async failInterruptedJobs(): Promise<void> {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(path.join(this.root, "jobs"));
    } catch {
      return;
    }
    for (const name of entries.filter((item) => item.endsWith(".json"))) {
      const job = await this.readJson<VideoRenderJob | null>(path.join(this.root, "jobs", name), null);
      if (!job) continue;
      if (job.status !== "queued" && job.status !== "processing") continue;
      const failed: VideoRenderJob = {
        ...job,
        status: "failed",
        stage: "failed",
        error: "Studio restarted before render completed.",
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      await this.writeJson(this.jobFile(job.id), failed);
      await this.patchVideo(job.projectId, { renderState: "failed" });
    }
  }

  private projectFile(projectId: string): string {
    return path.join(this.root, "projects", `${projectId}.json`);
  }

  private jobFile(jobId: string): string {
    return path.join(this.root, "jobs", `${jobId}.json`);
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      throw error;
    }
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${createHash("sha1").update(randomUUID()).digest("hex")}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, filePath);
  }

  private decorateVideo(video: VideoProject): VideoProject {
    return {
      ...video,
      outputStatus: computeOutputStatus(video),
    };
  }

  private ensureInitialized(): void {
    if (!this.isInitialized()) throw new Error("Video Production Manager is not initialized");
  }
}

function renderErrorCode(error: unknown): string {
  if (error instanceof VideoProductionError) return error.code;
  const message = error instanceof Error ? error.message : "";
  if (/ffprobe is not available/i.test(message)) return "FFPROBE_UNAVAILABLE";
  if (/missing or empty/i.test(message)) return "MISSING_OUTPUT";
  if (/not a valid video|dimensions do not match/i.test(message)) return "INVALID_OUTPUT";
  if (/FFmpeg failed|did not produce/i.test(message)) return "FFMPEG_FAILED";
  if (/empty or unreadable|Video output/i.test(message)) return "REGISTRATION_FAILED";
  return "RENDER_FAILED";
}

function mergeOverlay(statuses: VideoTextOverlayStatus[]): VideoTextOverlayStatus {
  if (statuses.includes("applied")) return "applied";
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("unavailable")) return "unavailable";
  return "skipped";
}

function recomputeStarts(clips: VideoTimelineClip[]): VideoTimelineClip[] {
  let cursor = 0;
  return clips.map((clip, index) => {
    const next = { ...clip, order: index + 1, startMs: cursor };
    cursor += next.durationMs;
    return next;
  });
}

function yieldLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export { VIDEO_PRODUCTION_VERSION };
