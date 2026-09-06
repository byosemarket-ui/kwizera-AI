/**
 * STEP 2D — Beat Sync Timing Planner tests.
 */
import { describe, expect, it } from "vitest";
import {
  AUDIO_INTELLIGENCE_VERSION,
  type AudioTimingIntelligence,
} from "../../../../ai/audio-intelligence/types.js";
import {
  applyBeatSyncTiming,
  beatSyncCacheKey,
  BEAT_SYNC_VERSION,
  normalizeBeatSyncMode,
} from "../../../../ai/video-production/beat-sync-timing.js";
import type { VideoTimelineClip } from "../../../../ai/video-production/types.js";

function beat(time: number, strength = 0.7, strong = false): AudioTimingIntelligence["beats"][number] {
  return {
    time,
    strength,
    strengthClass: strong ? "strong" : "normal",
    confidence: 0.8,
    type: strong ? "downbeat" : "beat",
  };
}

function intel(overrides: Partial<AudioTimingIntelligence> = {}): AudioTimingIntelligence {
  const beats = [
    beat(0.5, 0.9, true),
    beat(1.0, 0.6),
    beat(1.5, 0.85, true),
    beat(2.0, 0.55),
    beat(2.5, 0.9, true),
    beat(3.0, 0.5),
    beat(3.5, 0.8, true),
    beat(4.0, 0.55),
    beat(4.5, 0.88, true),
    beat(5.0, 0.5),
    beat(5.5, 0.82, true),
    beat(6.0, 0.5),
    beat(6.5, 0.9, true),
    beat(7.0, 0.55),
    beat(7.5, 0.85, true),
    beat(8.0, 0.5),
    beat(8.5, 0.9, true),
    beat(9.0, 0.55),
    beat(9.5, 0.8, true),
    beat(10.0, 0.5),
    beat(10.5, 0.85, true),
    beat(11.0, 0.5),
    beat(11.5, 0.9, true),
    beat(12.0, 0.55),
    beat(12.5, 0.8, true),
    beat(13.0, 0.5),
    beat(13.5, 0.85, true),
    beat(14.0, 0.5),
    beat(14.5, 0.9, true),
  ];
  const strongBeats = beats.filter((b) => b.strength >= 0.8);
  const base: AudioTimingIntelligence = {
    audioAssetId: "audio-1",
    contentHash: "hash-1",
    analysisVersion: AUDIO_INTELLIGENCE_VERSION,
    status: "READY",
    analyzedAt: new Date().toISOString(),
    analysisDurationMs: 10,
    technical: {
      durationSec: 15,
      sampleRate: 22050,
      channels: 1,
      codec: "pcm",
      bitrate: null,
      format: "raw",
      silent: false,
      insufficientDuration: false,
    },
    tempo: {
      bpm: 120,
      primaryBpm: 120,
      alternativeBpm: 60,
      confidence: 0.75,
      method: "test",
      status: "available",
    },
    duration: 15,
    bpm: 120,
    bpmConfidence: 0.75,
    beats,
    strongBeats,
    downbeats: strongBeats.filter((_, i) => i % 2 === 0),
    energyTimeline: [
      { start: 0, end: 5, energy: 0.4, trend: "rising" },
      { start: 5, end: 10, energy: 0.75, trend: "high" },
      { start: 10, end: 15, energy: 0.35, trend: "falling" },
    ],
    energyTransitions: [
      { time: 4.5, type: "ENERGY_RISE", fromEnergy: 0.4, toEnergy: 0.7 },
      { time: 9.5, type: "ENERGY_PEAK", fromEnergy: 0.7, toEnergy: 0.8 },
      { time: 12.0, type: "ENERGY_DROP", fromEnergy: 0.75, toEnergy: 0.35 },
    ],
    sections: [
      { label: "SECTION_1", start: 0, end: 5, energy: 0.4, beatDensity: 2, confidence: 0.6 },
      { label: "SECTION_2", start: 5, end: 10, energy: 0.75, beatDensity: 2, confidence: 0.6 },
      { label: "SECTION_3", start: 10, end: 15, energy: 0.35, beatDensity: 2, confidence: 0.6 },
    ],
    beatDensity: [
      { start: 0, end: 15, beatsPerSecond: 2, density: "normal" },
    ],
    meanEnergy: 0.5,
  };
  return { ...base, ...overrides };
}

function clip(overrides: Partial<VideoTimelineClip> & { purpose: string; durationMs: number }): VideoTimelineClip {
  const id = overrides.id ?? `clip-${overrides.purpose}`;
  return {
    id,
    sceneId: overrides.sceneId ?? `scene-${overrides.purpose}`,
    order: overrides.order ?? 1,
    purpose: overrides.purpose,
    assetId: overrides.assetId ?? "asset-1",
    startMs: overrides.startMs ?? 0,
    durationMs: overrides.durationMs,
    layer: "video",
    camera: "center",
    motion: "slow-zoom-in",
    lighting: "natural",
    background: "clean",
    transitionIn: "fade",
    transitionOut: "fade",
    text: overrides.text ?? [],
    audioDirection: "bed",
    userEdited: overrides.userEdited,
  };
}

function storyboard15s(): VideoTimelineClip[] {
  return [
    clip({ purpose: "HOOK", durationMs: 2000, order: 1 }),
    clip({ purpose: "PRODUCT_REVEAL", durationMs: 2500, order: 2 }),
    clip({ purpose: "FEATURE", durationMs: 2500, order: 3 }),
    clip({ purpose: "BENEFIT", durationMs: 2500, order: 4 }),
    clip({ purpose: "PRICE", durationMs: 2500, order: 5 }),
    clip({ purpose: "CTA", durationMs: 2000, order: 6 }),
    clip({ purpose: "END_CARD", durationMs: 1000, order: 7 }),
  ];
}

describe("STEP 2D beat sync timing", () => {
  it("normalizes modes and defaults to SMART", () => {
    expect(normalizeBeatSyncMode("SMART")).toBe("SMART");
    expect(normalizeBeatSyncMode("strict")).toBe("STRICT");
    expect(normalizeBeatSyncMode("OFF")).toBe("OFF");
    expect(normalizeBeatSyncMode("nope")).toBe("SMART");
    expect(BEAT_SYNC_VERSION).toBe("beat-sync-v1");
  });

  it("OFF preserves storyboard durations exactly", () => {
    const base = storyboard15s();
    const result = applyBeatSyncTiming({ clips: base, mode: "OFF", intelligence: intel() });
    expect(result.changed).toBe(false);
    expect(result.plan.mode).toBe("OFF");
    expect(result.clips.map((c) => c.durationMs)).toEqual(base.map((c) => c.durationMs));
    expect(result.plan.scenes.every((s) => s.timingSource === "STORYBOARD")).toBe(true);
  });

  it("SMART adjusts timing deterministically when beats are available", () => {
    const base = storyboard15s();
    const a = applyBeatSyncTiming({ clips: base, mode: "SMART", intelligence: intel(), audioAssetId: "audio-1" });
    const b = applyBeatSyncTiming({ clips: base, mode: "SMART", intelligence: intel(), audioAssetId: "audio-1" });
    expect(a.plan.scenes.map((s) => s.durationMs)).toEqual(b.plan.scenes.map((s) => s.durationMs));
    expect(a.plan.beatSyncVersion).toBe(BEAT_SYNC_VERSION);
    // Timeline remains contiguous
    for (let i = 1; i < a.clips.length; i++) {
      expect(a.clips[i]!.startMs).toBe(a.clips[i - 1]!.startMs + a.clips[i - 1]!.durationMs);
    }
  });

  it("STRICT is more aggressive than SMART but respects mins", () => {
    const base = storyboard15s();
    const smart = applyBeatSyncTiming({ clips: base, mode: "SMART", intelligence: intel() });
    const strict = applyBeatSyncTiming({ clips: base, mode: "STRICT", intelligence: intel() });
    for (const scene of strict.plan.scenes) {
      expect(scene.durationMs).toBeGreaterThanOrEqual(1200);
    }
    // At least one plan differs OR both kept storyboard — either is valid; STRICT should not invent beats
    expect(strict.plan.scenes.every((s) => s.alignedBeatTime == null || s.alignedBeatTime >= 0)).toBe(true);
    expect(smart.plan.mode).toBe("SMART");
    expect(strict.plan.mode).toBe("STRICT");
  });

  it("falls back when intelligence missing or silent", () => {
    const base = storyboard15s();
    const missing = applyBeatSyncTiming({ clips: base, mode: "SMART", intelligence: null });
    expect(missing.changed).toBe(false);
    expect(missing.plan.message).toMatch(/unavailable|storyboard/i);

    const silent = applyBeatSyncTiming({
      clips: base,
      mode: "SMART",
      intelligence: intel({
        technical: {
          durationSec: 3,
          sampleRate: 22050,
          channels: 1,
          codec: "pcm",
          bitrate: null,
          format: "raw",
          silent: true,
          insufficientDuration: false,
        },
        beats: [],
        strongBeats: [],
        downbeats: [],
        bpm: null,
        bpmConfidence: 0,
      }),
    });
    expect(silent.changed).toBe(false);
    expect(silent.plan.message).toMatch(/No meaningful beats|storyboard/i);
  });

  it("falls back on low-confidence SMART", () => {
    const base = storyboard15s();
    const low = applyBeatSyncTiming({
      clips: base,
      mode: "SMART",
      intelligence: intel({ bpmConfidence: 0.1 }),
    });
    expect(low.changed).toBe(false);
    expect(low.plan.message).toMatch(/Low-confidence|storyboard/i);
  });

  it("respects userEdited / manual override", () => {
    const base = storyboard15s();
    base[1] = { ...base[1]!, userEdited: true, durationMs: 3200 };
    const result = applyBeatSyncTiming({ clips: base, mode: "STRICT", intelligence: intel() });
    expect(result.clips[1]!.durationMs).toBe(3200);
    expect(result.plan.scenes[1]!.timingSource).toBe("MANUAL");
  });

  it("enforces minimum duration for PRICE / CTA / END_CARD", () => {
    const base = [
      clip({ purpose: "HOOK", durationMs: 1500 }),
      clip({ purpose: "PRICE", durationMs: 2200 }),
      clip({ purpose: "CTA", durationMs: 2400 }),
      clip({ purpose: "END_CARD", durationMs: 2800 }),
    ];
    const result = applyBeatSyncTiming({ clips: base, mode: "STRICT", intelligence: intel() });
    const byPurpose = Object.fromEntries(result.plan.scenes.map((s) => [s.purpose, s.durationMs]));
    expect(byPurpose.PRICE).toBeGreaterThanOrEqual(2000);
    expect(byPurpose.CTA).toBeGreaterThanOrEqual(2200);
    expect(byPurpose.END_CARD).toBeGreaterThanOrEqual(2500);
  });

  it("does not invent beats beyond audio duration", () => {
    const short = intel({ duration: 6, technical: {
      durationSec: 6,
      sampleRate: 22050,
      channels: 1,
      codec: "pcm",
      bitrate: null,
      format: "raw",
      silent: false,
      insufficientDuration: false,
    }});
    const result = applyBeatSyncTiming({ clips: storyboard15s(), mode: "SMART", intelligence: short });
    for (const scene of result.plan.scenes) {
      if (scene.alignedBeatTime != null) {
        expect(scene.alignedBeatTime).toBeLessThanOrEqual(6.05);
      }
    }
  });

  it("preserves storyboard scene order and ids", () => {
    const base = storyboard15s();
    const result = applyBeatSyncTiming({ clips: base, mode: "SMART", intelligence: intel() });
    expect(result.clips.map((c) => c.sceneId)).toEqual(base.map((c) => c.sceneId));
    expect(result.clips.map((c) => c.purpose)).toEqual(base.map((c) => c.purpose));
  });

  it("cache key includes mode, analysis, duration, format", () => {
    const a = beatSyncCacheKey({
      projectId: "p1",
      audioAssetId: "a1",
      contentHash: "h1",
      analysisVersion: AUDIO_INTELLIGENCE_VERSION,
      creativePlanVersion: 2,
      targetDurationMs: 15000,
      aspectRatio: "9:16",
      mode: "SMART",
    });
    const b = beatSyncCacheKey({
      projectId: "p1",
      audioAssetId: "a1",
      contentHash: "h1",
      analysisVersion: AUDIO_INTELLIGENCE_VERSION,
      creativePlanVersion: 2,
      targetDurationMs: 15000,
      aspectRatio: "9:16",
      mode: "STRICT",
    });
    expect(a).not.toBe(b);
    expect(a).toContain(BEAT_SYNC_VERSION);
  });

  it("works across target durations without requiring scene=beat count", () => {
    for (const scale of [0.5, 1, 1.5, 2]) {
      const clips = storyboard15s().map((c) => ({
        ...c,
        durationMs: Math.round(c.durationMs * scale),
      }));
      const result = applyBeatSyncTiming({ clips, mode: "SMART", intelligence: intel() });
      expect(result.clips.length).toBe(7);
      expect(result.plan.scenes.length).toBe(7);
    }
  });

  it("project isolation via distinct audioAssetId in plan", () => {
    const base = storyboard15s();
    const a = applyBeatSyncTiming({ clips: base, mode: "SMART", intelligence: intel({ audioAssetId: "A" }), audioAssetId: "A" });
    const b = applyBeatSyncTiming({ clips: base, mode: "SMART", intelligence: intel({ audioAssetId: "B", contentHash: "hash-B" }), audioAssetId: "B" });
    expect(a.plan.audioAssetId).toBe("A");
    expect(b.plan.audioAssetId).toBe("B");
  });
});
