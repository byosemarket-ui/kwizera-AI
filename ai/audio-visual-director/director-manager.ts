/**
 * STEP 2F — AudioVisualCreativeDirector manager (cache + persistence).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { CreativeWorkspaceManager } from "../creative-workspace/creative-workspace-manager.js";
import type { AudioIntelligenceManager } from "../audio-intelligence/audio-intelligence-manager.js";
import type { BeatSyncTimingPlan } from "../video-production/beat-sync-timing.js";
import type { VideoTimelineClip } from "../video-production/types.js";
import {
  buildAudioVisualCreativePlan,
  buildAvCreativePlanCacheKey,
  clipFingerprint,
} from "./plan-builder.js";
import { runAudioVisualQualityGate } from "./quality-gate.js";
import { normalizeCreativeMode } from "./creative-modes.js";
import {
  AV_CREATIVE_DIRECTOR_VERSION,
  AvDirectorError,
  type AudioVisualCreativePlan,
  type AvCreativeMode,
  type AvDirectorOverrides,
  type AvDirectorSettings,
  type AvDirectorStatus,
} from "./types.js";

interface StoredProjectDirector {
  projectId: string;
  settings: AvDirectorSettings;
  plan: AudioVisualCreativePlan | null;
  status: AvDirectorStatus;
  updatedAt: string;
}

export class AudioVisualCreativeDirector {
  private root = "";
  private workspace: CreativeWorkspaceManager | null = null;
  private intelligence: AudioIntelligenceManager | null = null;
  private memory = new Map<string, StoredProjectDirector>();

  async initialize(
    storageRoot: string,
    deps: {
      workspace: CreativeWorkspaceManager;
      audioIntelligence?: AudioIntelligenceManager | null;
    },
  ): Promise<void> {
    this.root = path.join(storageRoot, "creative-workspace", "av-creative-director");
    this.workspace = deps.workspace;
    this.intelligence = deps.audioIntelligence ?? null;
    await fs.mkdir(this.root, { recursive: true });
  }

  attachAudioIntelligence(manager: AudioIntelligenceManager): void {
    this.intelligence = manager;
  }

  isInitialized(): boolean {
    return Boolean(this.root && this.workspace);
  }

  async getSettings(projectId: string): Promise<AvDirectorSettings> {
    const stored = await this.load(projectId);
    return stored?.settings ?? { creativeMode: "BALANCED", overrides: {} };
  }

  async updateSettings(projectId: string, patch: {
    creativeMode?: AvCreativeMode | string;
    overrides?: AvDirectorOverrides;
  }): Promise<AvDirectorSettings> {
    this.ensureReady();
    const project = await this.workspace!.getProject(projectId);
    if (!project) throw new AvDirectorError("PROJECT_NOT_FOUND", "Project not found", 404);
    const current = await this.getSettings(projectId);
    const settings: AvDirectorSettings = {
      creativeMode: normalizeCreativeMode(patch.creativeMode ?? current.creativeMode),
      overrides: { ...current.overrides, ...(patch.overrides ?? {}) },
    };
    const unchanged =
      settings.creativeMode === current.creativeMode
      && JSON.stringify(settings.overrides) === JSON.stringify(current.overrides);
    const existing = await this.load(projectId);
    await this.save({
      projectId,
      settings,
      plan: unchanged ? (existing?.plan ?? null) : null,
      status: unchanged ? (existing?.status ?? "DIRECTOR_IDLE") : "DIRECTOR_IDLE",
      updatedAt: new Date().toISOString(),
    });
    console.info("[av-director] settings_updated", { projectId, creativeMode: settings.creativeMode, invalidated: !unchanged });
    return settings;
  }

  async getPlan(projectId: string): Promise<AudioVisualCreativePlan | null> {
    const stored = await this.load(projectId);
    return stored?.plan ?? null;
  }

  async getStatus(projectId: string): Promise<{
    status: AvDirectorStatus;
    plan: AudioVisualCreativePlan | null;
    settings: AvDirectorSettings;
  }> {
    const stored = await this.load(projectId);
    return {
      status: stored?.status ?? "DIRECTOR_IDLE",
      plan: stored?.plan ?? null,
      settings: stored?.settings ?? { creativeMode: "BALANCED", overrides: {} },
    };
  }

  /**
   * Build or reuse cached plan from existing beat-sync + audio intelligence + clips.
   * Does not render. Does not invent audio analysis.
   */
  async analyze(input: {
    projectId: string;
    clips: VideoTimelineClip[];
    beatPlan: BeatSyncTimingPlan | null;
    storyboardVersion?: number | null;
    aspectRatio: string;
    force?: boolean;
  }): Promise<{
    plan: AudioVisualCreativePlan;
    reused: boolean;
    qualityGate: ReturnType<typeof runAudioVisualQualityGate>;
  }> {
    this.ensureReady();
    const project = await this.workspace!.getProject(input.projectId);
    if (!project) throw new AvDirectorError("PROJECT_NOT_FOUND", "Project not found", 404);

    const settings = await this.getSettings(input.projectId);
    let audioIntel = null;
    const audioAssetId = project.selectedAudioAssetId ?? input.beatPlan?.audioAssetId ?? null;
    if (audioAssetId && this.intelligence?.isInitialized()) {
      audioIntel = await this.intelligence.getAnalysis(audioAssetId);
      if (audioIntel && audioIntel.status !== "READY") audioIntel = null;
    }

    const cacheKey = buildAvCreativePlanCacheKey({
      projectId: input.projectId,
      audioAssetId: audioIntel?.audioAssetId ?? audioAssetId,
      contentHash: audioIntel?.contentHash ?? input.beatPlan?.contentHash ?? null,
      analysisVersion: audioIntel?.analysisVersion ?? null,
      beatSyncVersion: input.beatPlan?.beatSyncVersion ?? null,
      beatMode: input.beatPlan?.mode ?? null,
      storyboardVersion: input.storyboardVersion ?? null,
      creativeMode: settings.creativeMode,
      overrides: settings.overrides,
      aspectRatio: input.aspectRatio,
      clipFingerprint: clipFingerprint(input.clips),
    });

    const existing = await this.load(input.projectId);
    if (!input.force && existing?.plan?.cacheKey === cacheKey && existing.plan.version === AV_CREATIVE_DIRECTOR_VERSION) {
      const qualityGate = runAudioVisualQualityGate(existing.plan);
      return { plan: existing.plan, reused: true, qualityGate };
    }

    await this.save({
      projectId: input.projectId,
      settings,
      plan: existing?.plan ?? null,
      status: "DIRECTOR_ANALYZING",
      updatedAt: new Date().toISOString(),
    });

    if (!input.clips.length) {
      throw new AvDirectorError(
        "MISSING_STORYBOARD",
        "Storyboard timeline is missing. Generate a Creative Plan first.",
        422,
      );
    }

    const plan = buildAudioVisualCreativePlan({
      projectId: input.projectId,
      clips: input.clips,
      beatPlan: settings.overrides.disableBeatSync ? null : input.beatPlan,
      audioIntel: settings.overrides.disableEnergySync ? null : audioIntel,
      creativeMode: settings.creativeMode,
      overrides: settings.overrides,
      storyboardVersion: input.storyboardVersion ?? null,
      aspectRatio: input.aspectRatio,
      productCategory: project.productInformation?.category,
      marketingObjective: project.campaignInformation?.objective,
    });
    // Ensure cache key matches manager key (plan builder also computes one).
    plan.cacheKey = cacheKey;
    if (!plan.planId) plan.planId = randomUUID();

    const qualityGate = runAudioVisualQualityGate(plan);
    await this.save({
      projectId: input.projectId,
      settings,
      plan,
      status: plan.status,
      updatedAt: new Date().toISOString(),
    });

    console.info("[av-director] plan_ready", {
      projectId: input.projectId,
      planId: plan.planId,
      audioAssetId: plan.audioAssetId,
      audioTimelineVersion: plan.audioTimelineVersion,
      beatTimingPlanVersion: plan.beatTimingPlanVersion,
      creativeMode: plan.creativeMode,
      confidence: plan.confidence,
      status: plan.status,
      fallbackReason: plan.fallbackReason,
      generationMs: plan.generationMs,
      qualityPassed: qualityGate.passed,
    });

    return { plan, reused: false, qualityGate };
  }

  async preview(projectId: string): Promise<{
    plan: AudioVisualCreativePlan | null;
    timeline: Array<{
      sceneId: string;
      startMs: number;
      endMs: number;
      role: string;
      energyBand: string;
      reasoning: string;
    }>;
    events: AudioVisualCreativePlan["emphasisEvents"];
    qualityGate: ReturnType<typeof runAudioVisualQualityGate>;
  }> {
    const plan = await this.getPlan(projectId);
    const qualityGate = runAudioVisualQualityGate(plan);
    return {
      plan,
      timeline: (plan?.scenes ?? []).map((s) => ({
        sceneId: s.sceneId,
        startMs: s.startTime,
        endMs: s.endTime,
        role: s.sceneRole,
        energyBand: s.energyBand,
        reasoning: s.reasoning,
      })),
      events: plan?.emphasisEvents ?? [],
      qualityGate,
    };
  }

  private file(projectId: string): string {
    return path.join(this.root, `${projectId}.json`);
  }

  private async load(projectId: string): Promise<StoredProjectDirector | null> {
    const cached = this.memory.get(projectId);
    if (cached) return cached;
    try {
      const raw = JSON.parse(await fs.readFile(this.file(projectId), "utf8")) as StoredProjectDirector;
      if (raw.projectId !== projectId) return null; // isolation guard
      this.memory.set(projectId, raw);
      return raw;
    } catch {
      return null;
    }
  }

  private async save(data: StoredProjectDirector): Promise<void> {
    if (data.plan && data.plan.projectId !== data.projectId) {
      throw new AvDirectorError("PROJECT_ISOLATION", "Plan projectId mismatch", 500);
    }
    this.memory.set(data.projectId, data);
    const target = this.file(data.projectId);
    const tmp = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    try {
      await fs.rename(tmp, target);
    } catch {
      await fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      await fs.rm(tmp, { force: true }).catch(() => undefined);
    }
  }

  private ensureReady(): void {
    if (!this.isInitialized()) {
      throw new AvDirectorError("NOT_READY", "Audio-Visual Creative Director is not initialized", 503);
    }
  }
}
