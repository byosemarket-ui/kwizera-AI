/**
 * STEP 2C — Audio Intelligence Manager.
 * Analyzes STEP 2B library assets; caches by contentHash + analysisVersion.
 * Single-flight job drain (same pattern as VideoProductionManager).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { AudioAsset } from "../creative-workspace/audio-asset.js";
import { FfmpegAudioError } from "../video-production/ffmpeg-renderer.js";
import { analyzeDecodedPcm } from "./analyze-signal.js";
import { decodeAudioToMonoPcm } from "./pcm-decode.js";
import {
  AUDIO_INTELLIGENCE_VERSION,
  type AudioAnalysisJobPublic,
  type AudioAnalysisLifecycle,
  type AudioTimingIntelligence,
} from "./types.js";

interface AnalysisJob {
  jobId: string;
  audioAssetId: string;
  contentHash: string;
  status: AudioAnalysisLifecycle;
  progress: number;
  stageMessage: string;
  createdAt: string;
  updatedAt: string;
  result?: AudioTimingIntelligence | null;
  error?: string | null;
}

export class AudioIntelligenceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
    this.name = "AudioIntelligenceError";
  }
}

export class AudioIntelligenceManager {
  private root = "";
  private workspace: CreativeWorkspaceManager | null = null;
  private analyzing = false;
  private draining = false;
  private jobs = new Map<string, AnalysisJob>();

  async initialize(storageRoot: string, deps: { workspace: CreativeWorkspaceManager }): Promise<void> {
    this.root = path.join(storageRoot, "creative-workspace", "audio-library", "analysis");
    this.workspace = deps.workspace;
    await fs.mkdir(this.root, { recursive: true });
    await fs.mkdir(this.jobsDir(), { recursive: true });
  }

  isInitialized(): boolean {
    return Boolean(this.root && this.workspace);
  }

  /**
   * Ensure analysis exists for an asset. Reuses cache when contentHash+version match.
   * Queues async analysis if missing. Returns current status immediately.
   */
  async ensureAnalysis(audioAssetId: string): Promise<{
    intelligence: AudioTimingIntelligence | null;
    job: AnalysisJobPublic | null;
    reused: boolean;
  }> {
    this.ensureReady();
    const asset = await this.workspace!.getAudioAsset(audioAssetId);
    if (!asset || asset.status !== "READY") {
      throw new AudioIntelligenceError("ASSET_NOT_FOUND", "Audio asset not found or not ready.", 404);
    }

    const cached = await this.readCache(asset.contentHash);
    if (cached && cached.analysisVersion === AUDIO_INTELLIGENCE_VERSION && cached.status === "READY") {
      // Keep assetId current if same content reused under different library id
      if (cached.audioAssetId !== audioAssetId) {
        const updated = { ...cached, audioAssetId };
        await this.writeCache(asset.contentHash, updated);
        await this.patchAssetMetadata(asset, updated);
        return { intelligence: updated, job: null, reused: true };
      }
      return { intelligence: cached, job: null, reused: true };
    }

    // Already queued/running for this hash?
    const existingJob = [...this.jobs.values()].find(
      (j) => j.contentHash === asset.contentHash
        && j.status !== "READY"
        && j.status !== "FAILED"
        && j.status !== "INVALID_AUDIO"
        && j.status !== "NO_AUDIO_STREAM"
        && j.status !== "ANALYSIS_TIMEOUT",
    );
    if (existingJob) {
      return { intelligence: null, job: this.toPublic(existingJob), reused: false };
    }

    const job = await this.enqueue(asset);
    this.scheduleDrain();
    return { intelligence: null, job: this.toPublic(job), reused: false };
  }

  async getAnalysis(audioAssetId: string): Promise<AudioTimingIntelligence | null> {
    this.ensureReady();
    const asset = await this.workspace!.getAudioAsset(audioAssetId);
    if (!asset) return null;
    const cached = await this.readCache(asset.contentHash);
    if (cached?.analysisVersion === AUDIO_INTELLIGENCE_VERSION) {
      return { ...cached, audioAssetId };
    }
    return null;
  }

  async getAnalysisByContentHash(contentHash: string): Promise<AudioTimingIntelligence | null> {
    this.ensureReady();
    return this.readCache(contentHash);
  }

  async getJob(jobId: string): Promise<AnalysisJobPublic | null> {
    const job = this.jobs.get(jobId) ?? await this.readJobFile(jobId);
    return job ? this.toPublic(job) : null;
  }

  async retryAnalysis(audioAssetId: string): Promise<{ job: AnalysisJobPublic }> {
    this.ensureReady();
    const asset = await this.workspace!.getAudioAsset(audioAssetId);
    if (!asset) {
      throw new AudioIntelligenceError("ASSET_NOT_FOUND", "Audio asset not found.", 404);
    }
    await fs.rm(this.cachePath(asset.contentHash), { force: true }).catch(() => undefined);
    const job = await this.enqueue(asset);
    this.scheduleDrain();
    return { job: this.toPublic(job) };
  }

  private async enqueue(asset: AudioAsset): Promise<AnalysisJob> {
    const now = new Date().toISOString();
    const job: AnalysisJob = {
      jobId: randomUUID(),
      audioAssetId: asset.assetId,
      contentHash: asset.contentHash,
      status: "QUEUED",
      progress: 0,
      stageMessage: "Queued for audio analysis",
      createdAt: now,
      updatedAt: now,
      result: null,
      error: null,
    };
    this.jobs.set(job.jobId, job);
    await this.writeJobFile(job);
    console.info("[audio-intelligence] queued", {
      jobId: job.jobId,
      audioAssetId: asset.assetId,
      contentHash: asset.contentHash,
      analysisVersion: AUDIO_INTELLIGENCE_VERSION,
    });
    return job;
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
    if (this.analyzing) return;
    const next = [...this.jobs.values()]
      .filter((j) => j.status === "QUEUED")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!next) return;
    this.analyzing = true;
    try {
      await this.processJob(next);
    } finally {
      this.analyzing = false;
    }
    if ([...this.jobs.values()].some((j) => j.status === "QUEUED")) {
      this.scheduleDrain();
    }
  }

  private async processJob(job: AnalysisJob): Promise<void> {
    const started = Date.now();
    const patch = async (
      status: AudioAnalysisLifecycle,
      progress: number,
      stageMessage: string,
      extra?: Partial<AnalysisJob>,
    ) => {
      Object.assign(job, {
        status,
        progress,
        stageMessage,
        updatedAt: new Date().toISOString(),
        ...extra,
      });
      this.jobs.set(job.jobId, job);
      await this.writeJobFile(job);
    };

    try {
      await patch("LOADING", 5, "Loading audio asset");
      const asset = await this.workspace!.getAudioAsset(job.audioAssetId);
      if (!asset || asset.contentHash !== job.contentHash) {
        throw new AudioIntelligenceError("ASSET_NOT_FOUND", "Audio asset missing during analysis.", 404);
      }
      const filePath = await this.workspace!.getAudioFilePath(job.audioAssetId);
      if (!filePath) {
        throw new AudioIntelligenceError("INVALID_AUDIO", "Audio file is missing on disk.", 400);
      }

      // Cache race: another job may have finished
      const existing = await this.readCache(job.contentHash);
      if (existing?.status === "READY" && existing.analysisVersion === AUDIO_INTELLIGENCE_VERSION) {
        const reused = { ...existing, audioAssetId: job.audioAssetId };
        await patch("READY", 100, "Analysis ready (cache)", { result: reused });
        await this.patchAssetMetadata(asset, reused);
        return;
      }

      await patch("DECODING", 20, "Decoding audio");
      const pcm = await decodeAudioToMonoPcm(filePath);

      await patch("ANALYZING", 40, "Analyzing signal");
      await patch("DETECTING_BEATS", 55, "Detecting beats");
      await patch("ANALYZING_ENERGY", 70, "Analyzing energy");
      await patch("ANALYZING_STRUCTURE", 82, "Analyzing structure");

      const signal = analyzeDecodedPcm(pcm);

      await patch("FINALIZING", 92, "Finalizing analysis");
      const intelligence: AudioTimingIntelligence = {
        audioAssetId: job.audioAssetId,
        contentHash: job.contentHash,
        analysisVersion: AUDIO_INTELLIGENCE_VERSION,
        status: "READY",
        analyzedAt: new Date().toISOString(),
        analysisDurationMs: Date.now() - started,
        technical: signal.technical,
        tempo: signal.tempo,
        duration: signal.technical.durationSec,
        bpm: signal.tempo.bpm,
        bpmConfidence: signal.tempo.confidence,
        beats: signal.beats,
        strongBeats: signal.strongBeats,
        downbeats: signal.downbeats,
        energyTimeline: signal.energyTimeline,
        energyTransitions: signal.energyTransitions,
        sections: signal.sections,
        beatDensity: signal.beatDensity,
        meanEnergy: signal.meanEnergy,
        message: signal.technical.silent
          ? "Audio is effectively silent — no meaningful beats."
          : signal.technical.insufficientDuration
            ? "Insufficient analysis duration — limited results."
            : signal.tempo.status === "low_confidence"
              ? "BPM estimate has low confidence."
              : undefined,
      };

      await this.writeCache(job.contentHash, intelligence);
      await this.patchAssetMetadata(asset, intelligence);
      await patch("READY", 100, "Analysis ready", { result: intelligence });

      console.info("[audio-intelligence] complete", {
        jobId: job.jobId,
        audioAssetId: job.audioAssetId,
        contentHash: job.contentHash,
        analysisVersion: AUDIO_INTELLIGENCE_VERSION,
        duration: intelligence.duration,
        bpm: intelligence.bpm,
        confidence: intelligence.bpmConfidence,
        beatCount: intelligence.beats.length,
        analysisDurationMs: intelligence.analysisDurationMs,
        status: intelligence.status,
      });
    } catch (error) {
      const { status, message } = classifyFailure(error);
      await patch(status, job.progress, message, { error: message, result: null });
      console.warn("[audio-intelligence] failed", {
        jobId: job.jobId,
        audioAssetId: job.audioAssetId,
        contentHash: job.contentHash,
        failureReason: message,
        status,
      });
    }
  }

  private async patchAssetMetadata(asset: AudioAsset, intel: AudioTimingIntelligence): Promise<void> {
    // Soft update via library index rewrite through workspace private path:
    // use list + internal write by re-reading index through ensureAnalysis consumers.
    // CreativeWorkspaceManager does not expose patchMetadata — write sidecar is enough;
    // also update in-memory via a dedicated workspace method if available.
    try {
      await this.workspace!.patchAudioAssetMetadata(asset.assetId, {
        bpm: intel.bpm,
        tempo: intel.bpm,
        energy: intel.meanEnergy,
        beats: intel.beats,
        sections: intel.sections,
        analysisStatus: intel.status,
        analysisVersion: intel.analysisVersion,
        bpmConfidence: intel.bpmConfidence,
        beatCount: intel.beats.length,
        analyzedAt: intel.analyzedAt,
      });
    } catch {
      /* metadata patch optional — cache file is authoritative */
    }
  }

  private cachePath(contentHash: string): string {
    const safe = contentHash.replace(/[^a-f0-9]/gi, "").slice(0, 64);
    return path.join(this.root, `${safe || "invalid"}.json`);
  }

  private jobsDir(): string {
    return path.join(this.root, "jobs");
  }

  private async readCache(contentHash: string): Promise<AudioTimingIntelligence | null> {
    try {
      const raw = await fs.readFile(this.cachePath(contentHash), "utf8");
      return JSON.parse(raw) as AudioTimingIntelligence;
    } catch {
      return null;
    }
  }

  private async writeCache(contentHash: string, value: AudioTimingIntelligence): Promise<void> {
    const filePath = this.cachePath(contentHash);
    const tmp = `${filePath}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(tmp, filePath);
  }

  private async writeJobFile(job: AnalysisJob): Promise<void> {
    const filePath = path.join(this.jobsDir(), `${job.jobId}.json`);
    const tmp = `${filePath}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(job, null, 2)}\n`, "utf8");
    await fs.rename(tmp, filePath);
  }

  private async readJobFile(jobId: string): Promise<AnalysisJob | null> {
    try {
      const raw = await fs.readFile(path.join(this.jobsDir(), `${jobId}.json`), "utf8");
      const job = JSON.parse(raw) as AnalysisJob;
      this.jobs.set(job.jobId, job);
      return job;
    } catch {
      return null;
    }
  }

  private toPublic(job: AnalysisJob): AudioAnalysisJobPublic {
    return {
      jobId: job.jobId,
      audioAssetId: job.audioAssetId,
      contentHash: job.contentHash,
      status: job.status,
      progress: job.progress,
      stageMessage: job.stageMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      result: job.result ?? null,
      error: job.error ?? null,
    };
  }

  private ensureReady(): void {
    if (!this.isInitialized()) {
      throw new AudioIntelligenceError("NOT_READY", "Audio Intelligence is not initialized.", 503);
    }
  }
}

function classifyFailure(error: unknown): { status: AudioAnalysisLifecycle; message: string } {
  if (error instanceof FfmpegAudioError) {
    if (error.code === "NO_AUDIO_STREAM") {
      return { status: "NO_AUDIO_STREAM", message: "No audio stream was found in this video." };
    }
    return { status: "INVALID_AUDIO", message: "The audio file could not be decoded." };
  }
  if (error instanceof AudioIntelligenceError) {
    if (error.code === "INVALID_AUDIO") return { status: "INVALID_AUDIO", message: error.message };
    return { status: "FAILED", message: error.message };
  }
  const msg = error instanceof Error ? error.message : "Audio analysis failed.";
  if (/timed out/i.test(msg)) return { status: "ANALYSIS_TIMEOUT", message: "Audio analysis timed out." };
  return { status: "FAILED", message: "Audio analysis failed. Retry." };
}
