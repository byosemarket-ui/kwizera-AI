/**
 * STEP 2E — AI Sound Manager.
 * Spec → provider → validate → Audio Asset (AI_GENERATED) → Audio Intelligence.
 * Never marks READY without a validated real audio file from an available provider.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { AudioIntelligenceManager } from "../audio-intelligence/audio-intelligence-manager.js";
import { probeAudio } from "../video-production/ffmpeg-renderer.js";
import { buildMusicGenerationSpec, generatedAudioTitle } from "./music-generation-spec.js";
import {
  resolveProductionMusicProvider,
  type MusicGenerationProvider,
} from "./provider.js";
import { AudioStyleProfileStore } from "./style-profile-store.js";
import {
  AI_SOUND_VERSION,
  AiSoundError,
  type AiSoundGenerateInput,
  type AiSoundJobLifecycle,
  type AiSoundJobPublic,
  type MusicGenerationSpec,
  type MusicProviderHealth,
} from "./types.js";

interface InternalJob {
  jobId: string;
  projectId: string;
  status: AiSoundJobLifecycle;
  progress: number;
  stageMessage: string;
  createdAt: string;
  updatedAt: string;
  audioAssetId?: string | null;
  error?: string | null;
  errorCode?: string | null;
  spec?: MusicGenerationSpec;
  providerId?: string | null;
  input: AiSoundGenerateInput;
  cancelled?: boolean;
}

export class AiSoundManager {
  private root = "";
  private workspace: CreativeWorkspaceManager | null = null;
  private intelligence: AudioIntelligenceManager | null = null;
  private provider: MusicGenerationProvider = resolveProductionMusicProvider();
  private styles = new AudioStyleProfileStore();
  private jobs = new Map<string, InternalJob>();
  private draining = false;
  private working = false;

  async initialize(
    storageRoot: string,
    deps: {
      workspace: CreativeWorkspaceManager;
      audioIntelligence?: AudioIntelligenceManager | null;
      provider?: MusicGenerationProvider;
    },
  ): Promise<void> {
    this.root = path.join(storageRoot, "creative-workspace", "ai-sound");
    this.workspace = deps.workspace;
    this.intelligence = deps.audioIntelligence ?? null;
    if (deps.provider) this.provider = deps.provider;
    await fs.mkdir(this.root, { recursive: true });
    await fs.mkdir(path.join(this.root, "jobs"), { recursive: true });
    await fs.mkdir(path.join(this.root, "tmp"), { recursive: true });
    await this.styles.initialize(storageRoot);
  }

  attachAudioIntelligence(manager: AudioIntelligenceManager): void {
    this.intelligence = manager;
  }

  /** Test injection only. */
  setProviderForTests(provider: MusicGenerationProvider): void {
    this.provider = provider;
  }

  isInitialized(): boolean {
    return Boolean(this.root && this.workspace);
  }

  hasActiveJobs(): boolean {
    return [...this.jobs.values()].some(
      (j) => !["READY", "FAILED", "CANCELLED", "TIMEOUT"].includes(j.status),
    );
  }

  async health(): Promise<MusicProviderHealth & { aiSoundVersion: string }> {
    this.ensureReady();
    const health = await this.provider.healthCheck();
    return { ...health, aiSoundVersion: AI_SOUND_VERSION };
  }

  async buildSpecPreview(input: AiSoundGenerateInput): Promise<MusicGenerationSpec> {
    this.ensureReady();
    return this.resolveSpec(input);
  }

  async startGeneration(input: AiSoundGenerateInput): Promise<AiSoundJobPublic> {
    this.ensureReady();
    const project = await this.workspace!.getProject(input.projectId);
    if (!project) throw new AiSoundError("PROJECT_NOT_FOUND", "Project not found", 404);

    const health = await this.provider.healthCheck();
    if (!health.available) {
      throw new AiSoundError(
        "MUSIC_GENERATION_UNAVAILABLE",
        health.reason ?? "AI Sound Generation is currently unavailable on this system.",
        503,
      );
    }

    const active = [...this.jobs.values()].filter(
      (j) => j.status !== "READY" && j.status !== "FAILED" && j.status !== "CANCELLED" && j.status !== "TIMEOUT",
    );
    if (active.length >= 1) {
      throw new AiSoundError(
        "RESOURCE_LIMITED",
        "Another AI Sound generation is already running. Wait for it to finish.",
        409,
      );
    }

    const now = new Date().toISOString();
    const job: InternalJob = {
      jobId: randomUUID(),
      projectId: input.projectId,
      status: "QUEUED",
      progress: 0,
      stageMessage: "Queued for AI sound generation",
      createdAt: now,
      updatedAt: now,
      input,
      providerId: this.provider.id,
    };
    this.jobs.set(job.jobId, job);
    await this.persistJob(job);
    this.scheduleDrain();
    return this.toPublic(job);
  }

  async getJob(jobId: string): Promise<AiSoundJobPublic | null> {
    this.ensureReady();
    const job = this.jobs.get(jobId) ?? await this.readJob(jobId);
    return job ? this.toPublic(job) : null;
  }

  async cancelJob(jobId: string): Promise<AiSoundJobPublic | null> {
    this.ensureReady();
    const job = this.jobs.get(jobId) ?? await this.readJob(jobId);
    if (!job) return null;
    if (job.status === "READY" || job.status === "FAILED" || job.status === "CANCELLED") {
      return this.toPublic(job);
    }
    job.cancelled = true;
    job.status = "CANCELLED";
    job.progress = 0;
    job.stageMessage = "Cancelled";
    job.updatedAt = new Date().toISOString();
    await this.persistJob(job);
    return this.toPublic(job);
  }

  getStyleStore(): AudioStyleProfileStore {
    return this.styles;
  }

  async analyzeStyleFromAssets(input: {
    projectId: string;
    name?: string;
    audioAssetIds: string[];
    profileId?: string;
  }) {
    this.ensureReady();
    if (!input.audioAssetIds.length) {
      throw new AiSoundError("INVALID_INPUT", "Select at least one reference audio asset.");
    }
    const analyses = [];
    for (const assetId of input.audioAssetIds) {
      const asset = await this.workspace!.getAudioAsset(assetId);
      if (!asset || asset.status !== "READY") {
        throw new AiSoundError("ASSET_NOT_FOUND", `Audio asset not found: ${assetId}`, 404);
      }
      let intel = this.intelligence ? await this.intelligence.getAnalysis(assetId) : null;
      if ((!intel || intel.status !== "READY") && this.intelligence) {
        const ensured = await this.intelligence.ensureAnalysis(assetId);
        intel = ensured.intelligence;
      }
      if (intel?.status === "READY") {
        analyses.push({
          bpm: intel.bpm,
          bpmConfidence: intel.bpmConfidence,
          meanEnergy: intel.meanEnergy,
          beatDensity: intel.beatDensity,
        });
      }
    }
    if (!analyses.length) {
      throw new AiSoundError(
        "ANALYSIS_REQUIRED",
        "Reference audio must have STEP 2C analysis READY before building a style profile.",
        422,
      );
    }
    const preferences = this.styles.preferencesFromAnalyses(analyses);
    return this.styles.upsert({
      profileId: input.profileId,
      name: input.name ?? "Advertising Style",
      projectId: input.projectId,
      preferences,
      sourceAudioAssetIds: input.audioAssetIds,
    });
  }

  async recordStyleFeedback(input: {
    projectId: string;
    audioAssetId: string;
    signal: "like_style" | "dislike_style";
  }) {
    this.ensureReady();
    const asset = await this.workspace!.getAudioAsset(input.audioAssetId);
    if (!asset) throw new AiSoundError("ASSET_NOT_FOUND", "Audio asset not found", 404);
    return this.styles.recordPreferenceSignal(input);
  }

  private async resolveSpec(input: AiSoundGenerateInput): Promise<MusicGenerationSpec> {
    const project = await this.workspace!.getProject(input.projectId);
    if (!project) throw new AiSoundError("PROJECT_NOT_FOUND", "Project not found", 404);
    const durationSeconds = input.durationSeconds
      ?? Number(project.campaignInformation?.customDurationSeconds)
      ?? (String(project.campaignInformation?.duration ?? "15").match(/\d+/)
        ? Number(String(project.campaignInformation?.duration).match(/\d+/)![0])
        : 15);

    let styleProfile = null;
    if (input.styleProfileId) {
      styleProfile = await this.styles.get(input.styleProfileId);
      if (!styleProfile) throw new AiSoundError("STYLE_NOT_FOUND", "Style profile not found", 404);
      if (styleProfile.projectId && styleProfile.projectId !== input.projectId) {
        throw new AiSoundError("STYLE_ISOLATION", "Style profile belongs to another project", 403);
      }
    }

    let referenceHints: { bpm?: number | null; meanEnergy?: number | null; beatDensity?: "sparse" | "normal" | "dense" | null } | null = null;
    const refIds = input.referenceAudioAssetIds?.length
      ? input.referenceAudioAssetIds
      : styleProfile?.sourceAudioAssetIds ?? [];
    if (refIds[0] && this.intelligence) {
      const intel = await this.intelligence.getAnalysis(refIds[0]);
      if (intel?.status === "READY") {
        const dens = intel.beatDensity?.[0]?.density ?? null;
        referenceHints = {
          bpm: intel.bpm,
          meanEnergy: intel.meanEnergy,
          beatDensity: dens === "sparse" || dens === "normal" || dens === "dense" ? dens : null,
        };
      }
    }

    return buildMusicGenerationSpec({
      productName: project.productInformation?.name,
      productCategory: project.productInformation?.category,
      campaignObjective: project.campaignInformation?.objective,
      platform: project.platform,
      targetAudience: project.targetAudience,
      brandName: project.brandInformation?.name,
      callToAction: project.campaignInformation?.callToAction,
      durationSeconds,
      mood: input.mood,
      energy: input.energy,
      tempo: input.tempo,
      mode: input.mode,
      styleProfile,
      referenceHints,
      userNotes: input.userNotes,
    });
  }

  private scheduleDrain(): void {
    if (this.draining) return;
    this.draining = true;
    setImmediate(() => {
      void this.drain().finally(() => {
        this.draining = false;
        const pending = [...this.jobs.values()].some((j) => j.status === "QUEUED");
        if (pending) this.scheduleDrain();
      });
    });
  }

  private async drain(): Promise<void> {
    if (this.working) return;
    const next = [...this.jobs.values()].find((j) => j.status === "QUEUED");
    if (!next) return;
    this.working = true;
    try {
      await this.runJob(next);
    } finally {
      this.working = false;
    }
  }

  private async runJob(job: InternalJob): Promise<void> {
    const touch = async (
      status: AiSoundJobLifecycle,
      progress: number,
      stageMessage: string,
    ) => {
      if (job.cancelled) {
        job.status = "CANCELLED";
        job.stageMessage = "Cancelled";
        job.updatedAt = new Date().toISOString();
        await this.persistJob(job);
        throw new AiSoundError("CANCELLED", "Generation cancelled");
      }
      job.status = status;
      job.progress = progress;
      job.stageMessage = stageMessage;
      job.updatedAt = new Date().toISOString();
      await this.persistJob(job);
    };

    let tmpPath: string | null = null;
    try {
      await touch("PREPARING", 5, "Preparing music generation specification");
      const spec = await this.resolveSpec(job.input);
      job.spec = spec;
      job.providerId = this.provider.id;

      const health = await this.provider.healthCheck();
      if (!health.available) {
        throw new AiSoundError(
          "MUSIC_GENERATION_UNAVAILABLE",
          health.reason ?? "Provider unavailable",
          503,
        );
      }

      await touch("GENERATING", 25, "Generating audio with configured provider");
      const result = await this.provider.generate({
        projectId: job.projectId,
        spec,
        titleHint: job.input.titleHint,
      });
      tmpPath = result.filePath;

      if (job.cancelled) throw new AiSoundError("CANCELLED", "Generation cancelled");

      await touch("FINALIZING", 55, "Finalizing generated audio");
      await touch("VALIDATING", 65, "Validating generated audio");
      const probed = await probeAudio(result.filePath);
      if (!probed.durationMs || probed.durationMs < 500) {
        throw new AiSoundError("INVALID_OUTPUT", "Generated audio duration is invalid");
      }
      const data = await fs.readFile(result.filePath);
      if (!data.length) throw new AiSoundError("INVALID_OUTPUT", "Generated audio file is empty");

      await touch("SAVING", 80, "Saving generated audio to Audio Library");
      const title = job.input.titleHint?.trim() || generatedAudioTitle(spec);
      const registered = await this.workspace!.registerAiGeneratedAudio(job.projectId, {
        title,
        mimeType: result.mimeType || probed.mimeHint || "audio/wav",
        data,
        generation: {
          aiSoundVersion: AI_SOUND_VERSION,
          providerId: result.providerId,
          modelId: result.modelId,
          modelVersion: result.modelVersion,
          spec,
        },
      });

      job.audioAssetId = registered.audio.assetId;

      await touch("ANALYZING", 90, "Running Audio Intelligence analysis");
      if (this.intelligence?.isInitialized()) {
        await this.intelligence.ensureAnalysis(registered.audio.assetId).catch(() => null);
      }

      await this.workspace!.selectProjectAudio(job.projectId, registered.audio.assetId);

      job.status = "READY";
      job.progress = 100;
      job.stageMessage = "AI Sound ready";
      job.updatedAt = new Date().toISOString();
      await this.persistJob(job);
    } catch (error) {
      if (job.status === "CANCELLED") return;
      const code = (error as { code?: string })?.code
        ?? (error instanceof AiSoundError ? error.code : "GENERATION_FAILED");
      job.status = code === "CANCELLED" ? "CANCELLED" : "FAILED";
      job.progress = 0;
      job.errorCode = code;
      job.error = error instanceof Error ? error.message : String(error);
      job.stageMessage = job.error;
      job.updatedAt = new Date().toISOString();
      await this.persistJob(job);
    } finally {
      if (tmpPath) {
        try {
          await fs.rm(path.dirname(tmpPath), { recursive: true, force: true });
        } catch { /* temp cleanup best-effort */ }
      }
    }
  }

  private toPublic(job: InternalJob): AiSoundJobPublic {
    return {
      jobId: job.jobId,
      projectId: job.projectId,
      status: job.status,
      progress: job.progress,
      stageMessage: job.stageMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      audioAssetId: job.audioAssetId ?? null,
      error: job.error ?? null,
      errorCode: job.errorCode ?? null,
      spec: job.spec,
      providerId: job.providerId ?? null,
    };
  }

  private jobFile(jobId: string): string {
    return path.join(this.root, "jobs", `${jobId}.json`);
  }

  private async persistJob(job: InternalJob): Promise<void> {
    this.jobs.set(job.jobId, job);
    const target = this.jobFile(job.jobId);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(tmp, `${JSON.stringify(this.toPublic(job), null, 2)}\n`, "utf8");
      try {
        await fs.rename(tmp, target);
      } catch {
        await fs.writeFile(target, `${JSON.stringify(this.toPublic(job), null, 2)}\n`, "utf8");
        await fs.rm(tmp, { force: true }).catch(() => undefined);
      }
    } catch {
      // Best-effort persistence — in-memory job state remains authoritative for the process.
    }
  }

  private async readJob(jobId: string): Promise<InternalJob | null> {
    try {
      const raw = JSON.parse(await fs.readFile(this.jobFile(jobId), "utf8")) as AiSoundJobPublic;
      const job: InternalJob = {
        ...raw,
        input: { projectId: raw.projectId },
      };
      this.jobs.set(jobId, job);
      return job;
    } catch {
      return null;
    }
  }

  private ensureReady(): void {
    if (!this.isInitialized()) throw new AiSoundError("NOT_READY", "AI Sound manager is not initialized", 503);
  }
}
