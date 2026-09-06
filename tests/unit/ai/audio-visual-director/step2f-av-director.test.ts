import { describe, expect, it } from "vitest";
import {
  buildAudioVisualCreativePlan,
  buildVisualEnergyProfile,
  energyBand,
  normalizeCreativeMode,
  policyForMode,
  runAudioVisualQualityGate,
  applyDirectorPlanToClips,
  AudioVisualCreativeDirector,
} from "../../../../ai/audio-visual-director/index.js";
import type { AudioTimingIntelligence } from "../../../../ai/audio-intelligence/types.js";
import type { BeatSyncTimingPlan } from "../../../../ai/video-production/beat-sync-timing.js";
import type { VideoTimelineClip } from "../../../../ai/video-production/types.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";

function clip(partial: Partial<VideoTimelineClip> & { id: string; sceneId: string; purpose: string; durationMs: number }): VideoTimelineClip {
  return {
    assetId: "asset-1",
    camera: "medium",
    motion: "slow-zoom",
    transitionIn: "cut",
    transitionOut: "cut",
    text: [],
    audioDirection: "none",
    ...partial,
  } as VideoTimelineClip;
}

function silentIntel(): AudioTimingIntelligence {
  return {
    audioAssetId: "a1",
    contentHash: "hash",
    analysisVersion: "audio-intelligence-v1",
    status: "READY",
    analyzedAt: new Date().toISOString(),
    analysisDurationMs: 10,
    technical: {
      durationSec: 12,
      sampleRate: 22050,
      channels: 1,
      codec: "pcm",
      bitrate: null,
      format: "wav",
      silent: true,
      insufficientDuration: false,
    },
    tempo: {
      bpm: null,
      primaryBpm: null,
      alternativeBpm: null,
      confidence: 0,
      method: "none",
      status: "unavailable",
    },
    duration: 12,
    bpm: null,
    bpmConfidence: 0,
    beats: [],
    strongBeats: [],
    downbeats: [],
    energyTimeline: [],
    energyTransitions: [],
    sections: [],
    beatDensity: [],
    meanEnergy: 0,
  };
}

function beatIntel(): AudioTimingIntelligence {
  const base = silentIntel();
  return {
    ...base,
    technical: { ...base.technical, silent: false },
    tempo: {
      bpm: 120,
      primaryBpm: 120,
      alternativeBpm: null,
      confidence: 0.7,
      method: "test",
      status: "available",
    },
    bpm: 120,
    bpmConfidence: 0.7,
    meanEnergy: 0.62,
    beats: [
      { time: 0.5, strength: 0.5, strengthClass: "normal", confidence: 0.8 },
      { time: 1.0, strength: 0.8, strengthClass: "strong", confidence: 0.9 },
      { time: 2.0, strength: 0.6, strengthClass: "normal", confidence: 0.8 },
      { time: 3.0, strength: 0.85, strengthClass: "strong", confidence: 0.9 },
      { time: 4.0, strength: 0.55, strengthClass: "normal", confidence: 0.8 },
      { time: 8.0, strength: 0.7, strengthClass: "strong", confidence: 0.85 },
      { time: 11.0, strength: 0.65, strengthClass: "strong", confidence: 0.8 },
    ],
    strongBeats: [
      { time: 1.0, strength: 0.8, strengthClass: "strong", confidence: 0.9 },
      { time: 3.0, strength: 0.85, strengthClass: "strong", confidence: 0.9 },
      { time: 8.0, strength: 0.7, strengthClass: "strong", confidence: 0.85 },
      { time: 11.0, strength: 0.65, strengthClass: "strong", confidence: 0.8 },
    ],
    energyTimeline: [
      { start: 0, end: 3, energy: 0.35 },
      { start: 3, end: 8, energy: 0.7 },
      { start: 8, end: 12, energy: 0.4 },
    ],
  };
}

function beatPlan(clips: VideoTimelineClip[]): BeatSyncTimingPlan {
  let t = 0;
  return {
    beatSyncVersion: "beat-sync-v1",
    mode: "SMART",
    audioAssetId: "a1",
    contentHash: "hash",
    analysisVersion: "audio-intelligence-v1",
    videoDurationMs: clips.reduce((s, c) => s + c.durationMs, 0),
    baseDurationMs: clips.reduce((s, c) => s + c.durationMs, 0),
    createdAt: new Date().toISOString(),
    message: "test",
    scenes: clips.map((c) => {
      const start = t;
      t += c.durationMs;
      return {
        sceneId: c.sceneId,
        clipId: c.id,
        purpose: c.purpose,
        startMs: start,
        endMs: t,
        durationMs: c.durationMs,
        baseDurationMs: c.durationMs,
        timingSource: "BEAT" as const,
        alignedBeatTime: start / 1000,
        alignmentType: "STRONG_BEAT" as const,
        confidence: 0.7,
        transitionTime: t / 1000,
      };
    }),
  };
}

describe("STEP 2F Audio-Visual Creative Director", () => {
  it("maps energy bands and creative modes", () => {
    expect(energyBand(0.1)).toBe("very_calm");
    expect(energyBand(0.5)).toBe("balanced");
    expect(energyBand(0.9)).toBe("peak");
    expect(normalizeCreativeMode("energetic")).toBe("ENERGETIC");
    expect(policyForMode("CALM").motionScale).toBeLessThan(policyForMode("AGGRESSIVE").motionScale);
  });

  it("builds energy profile from AudioTimeline without fabricating", () => {
    const missing = buildVisualEnergyProfile(null);
    expect(missing.source).toBe("UNAVAILABLE");
    expect(missing.samples).toHaveLength(0);
    const silent = buildVisualEnergyProfile(silentIntel());
    expect(silent.source).toBe("FALLBACK");
    const ready = buildVisualEnergyProfile(beatIntel());
    expect(ready.source).toBe("AUDIO_TIMELINE");
    expect(ready.samples.length).toBeGreaterThan(0);
  });

  it("produces deterministic plans for same inputs", () => {
    const clips = [
      clip({ id: "c1", sceneId: "s1", purpose: "HOOK", durationMs: 2000 }),
      clip({ id: "c2", sceneId: "s2", purpose: "PRODUCT REVEAL", durationMs: 3000 }),
      clip({ id: "c3", sceneId: "s3", purpose: "FEATURE", durationMs: 2500 }),
      clip({ id: "c4", sceneId: "s4", purpose: "CTA", durationMs: 2500 }),
      clip({ id: "c5", sceneId: "s5", purpose: "END CARD", durationMs: 3000 }),
    ];
    const intel = beatIntel();
    const planA = buildAudioVisualCreativePlan({
      projectId: "p1",
      clips,
      beatPlan: beatPlan(clips),
      audioIntel: intel,
      creativeMode: "ENERGETIC",
      aspectRatio: "9:16",
      productCategory: "Running Shoes",
      marketingObjective: "Promote Sale",
      storyboardVersion: 3,
    });
    const planB = buildAudioVisualCreativePlan({
      projectId: "p1",
      clips,
      beatPlan: beatPlan(clips),
      audioIntel: intel,
      creativeMode: "ENERGETIC",
      aspectRatio: "9:16",
      productCategory: "Running Shoes",
      marketingObjective: "Promote Sale",
      storyboardVersion: 3,
    });
    expect(planA.cacheKey).toBe(planB.cacheKey);
    expect(planA.scenes.map((s) => s.duration)).toEqual(planB.scenes.map((s) => s.duration));
    expect(planA.scenes.map((s) => s.motionIntensity)).toEqual(planB.scenes.map((s) => s.motionIntensity));
    expect(planA.creativeMode).toBe("ENERGETIC");
    expect(planA.hookEvents.length).toBeGreaterThan(0);
    expect(planA.productRevealEvents.length).toBeGreaterThan(0);
    expect(planA.CTAEvents[0]?.minReadableMs).toBeGreaterThanOrEqual(2200);
    expect(planA.endCardTiming?.minReadableMs).toBeGreaterThanOrEqual(2500);
    expect(planA.version).toBe("av-creative-director-v1");
  });

  it("falls back safely for silence / missing analysis", () => {
    const clips = [
      clip({ id: "c1", sceneId: "s1", purpose: "HOOK", durationMs: 2000 }),
      clip({ id: "c2", sceneId: "s2", purpose: "CTA", durationMs: 2500 }),
    ];
    const plan = buildAudioVisualCreativePlan({
      projectId: "p1",
      clips,
      beatPlan: null,
      audioIntel: silentIntel(),
      creativeMode: "BALANCED",
      aspectRatio: "9:16",
    });
    expect(plan.confidence).toBe("LOW");
    expect(plan.status).toMatch(/FALLBACK|LOW_CONFIDENCE/);
    expect(plan.fallbackReason).toBeTruthy();
    expect(plan.emphasisEvents.every((e) => e.type !== "STRONG_BEAT")).toBe(true);
  });

  it("respects manual overrides (reduce motion / disable beat sync)", () => {
    const clips = [
      clip({ id: "c1", sceneId: "s1", purpose: "PRODUCT REVEAL", durationMs: 3000 }),
      clip({ id: "c2", sceneId: "s2", purpose: "FEATURE", durationMs: 2500 }),
    ];
    const plan = buildAudioVisualCreativePlan({
      projectId: "p1",
      clips,
      beatPlan: beatPlan(clips),
      audioIntel: beatIntel(),
      creativeMode: "AGGRESSIVE",
      aspectRatio: "9:16",
      overrides: { reduceMotion: true, disableBeatSync: true, forceMode: "CALM" },
    });
    expect(plan.creativeMode).toBe("CALM");
    expect(plan.scenes.every((s) => s.motionIntensity !== "HIGH")).toBe(true);
    expect(plan.fallbackReason).toMatch(/Beat sync disabled/i);
  });

  it("quality gate catches overlaps and passes valid plans", () => {
    const clips = [
      clip({ id: "c1", sceneId: "s1", purpose: "HOOK", durationMs: 2000 }),
      clip({ id: "c2", sceneId: "s2", purpose: "CTA", durationMs: 2500 }),
      clip({ id: "c3", sceneId: "s3", purpose: "END CARD", durationMs: 3000 }),
    ];
    const plan = buildAudioVisualCreativePlan({
      projectId: "p1",
      clips,
      beatPlan: beatPlan(clips),
      audioIntel: beatIntel(),
      aspectRatio: "9:16",
    });
    const gate = runAudioVisualQualityGate(plan);
    expect(gate.passed).toBe(true);

    const broken = {
      ...plan,
      scenes: [
        { ...plan.scenes[0]!, endTime: 5000 },
        { ...plan.scenes[1]!, startTime: 4000 },
      ],
    };
    expect(runAudioVisualQualityGate(broken).passed).toBe(false);
    expect(runAudioVisualQualityGate(null).passed).toBe(false);
  });

  it("applies director decisions onto clips without changing scene identity", () => {
    const clips = [
      clip({
        id: "c1",
        sceneId: "s1",
        purpose: "HOOK",
        durationMs: 2000,
        motionParams: {
          maxZoom: 1.1,
          focusX: 0.5,
          focusY: 0.5,
          intensity: 1,
          directedType: "PUSH_IN",
          framingBasis: "none",
          safetyAdjusted: false,
          fallbackUsed: false,
        },
      }),
    ];
    const plan = buildAudioVisualCreativePlan({
      projectId: "p1",
      clips,
      beatPlan: beatPlan(clips),
      audioIntel: beatIntel(),
      creativeMode: "CALM",
      aspectRatio: "9:16",
    });
    const applied = applyDirectorPlanToClips(clips, plan);
    expect(applied[0]!.sceneId).toBe("s1");
    expect(applied[0]!.durationMs).toBe(2000);
    expect(applied[0]!.motionParams!.intensity).toBeLessThanOrEqual(1);
  });
});

describe("STEP 2F director persistence isolation", () => {
  let root: string;
  let workspace: CreativeWorkspaceManager;
  let director: AudioVisualCreativeDirector;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-2f-"));
    workspace = new CreativeWorkspaceManager();
    await workspace.initialize(root);
    director = new AudioVisualCreativeDirector();
    await director.initialize(root, { workspace });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("isolates settings/plans between projects", async () => {
    const a = await workspace.createProject("A");
    const b = await workspace.createProject("B");
    await director.updateSettings(a.id, { creativeMode: "CINEMATIC" });
    await director.updateSettings(b.id, { creativeMode: "ENERGETIC" });
    expect((await director.getSettings(a.id)).creativeMode).toBe("CINEMATIC");
    expect((await director.getSettings(b.id)).creativeMode).toBe("ENERGETIC");

    const clips = [
      clip({ id: "c1", sceneId: "s1", purpose: "HOOK", durationMs: 2000 }),
      clip({ id: "c2", sceneId: "s2", purpose: "CTA", durationMs: 2500 }),
    ];
    const planA = await director.analyze({
      projectId: a.id,
      clips,
      beatPlan: null,
      aspectRatio: "9:16",
    });
    const planB = await director.analyze({
      projectId: b.id,
      clips,
      beatPlan: null,
      aspectRatio: "9:16",
    });
    expect(planA.plan.projectId).toBe(a.id);
    expect(planB.plan.projectId).toBe(b.id);
    expect((await director.getPlan(a.id))?.projectId).toBe(a.id);
    expect((await director.getPlan(b.id))?.projectId).toBe(b.id);
  });

  it("reuses cached plan until inputs change", async () => {
    const project = await workspace.createProject("Cache");
    const clips = [clip({ id: "c1", sceneId: "s1", purpose: "HOOK", durationMs: 2000 })];
    const first = await director.analyze({
      projectId: project.id,
      clips,
      beatPlan: null,
      aspectRatio: "9:16",
    });
    const second = await director.analyze({
      projectId: project.id,
      clips,
      beatPlan: null,
      aspectRatio: "9:16",
    });
    expect(second.reused).toBe(true);
    expect(second.plan.planId).toBe(first.plan.planId);
    await director.updateSettings(project.id, { creativeMode: "ENERGETIC" });
    const third = await director.analyze({
      projectId: project.id,
      clips,
      beatPlan: null,
      aspectRatio: "9:16",
    });
    expect(third.reused).toBe(false);
    expect(third.plan.creativeMode).toBe("ENERGETIC");
  });
});
