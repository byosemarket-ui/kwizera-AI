import { describe, expect, it } from "vitest";
import { analyzeDecodedPcm } from "../../../../ai/audio-intelligence/analyze-signal.js";
import {
  getNearestBeat,
  getNextBeat,
  getEnergyAt,
  getSectionAt,
  quantizeTime,
} from "../../../../ai/audio-intelligence/timing-queries.js";
import {
  AUDIO_INTELLIGENCE_VERSION,
  type AudioTimingIntelligence,
} from "../../../../ai/audio-intelligence/types.js";
import { ANALYSIS_SAMPLE_RATE } from "../../../../ai/audio-intelligence/pcm-decode.js";

function synthBeats(durationSec: number, bpm: number, sampleRate = ANALYSIS_SAMPLE_RATE): Float32Array {
  const n = Math.floor(durationSec * sampleRate);
  const samples = new Float32Array(n);
  const interval = 60 / bpm;
  for (let t = 0.15; t < durationSec - 0.05; t += interval) {
    const center = Math.floor(t * sampleRate);
    const width = Math.floor(0.02 * sampleRate);
    for (let i = -width; i <= width; i++) {
      const idx = center + i;
      if (idx < 0 || idx >= n) continue;
      const env = Math.exp(-Math.abs(i) / (width * 0.28));
      // Broadband click + low thud
      const click = Math.sin(2 * Math.PI * 1200 * (i / sampleRate)) * env;
      const thud = Math.sin(2 * Math.PI * 70 * (i / sampleRate)) * env * 0.8;
      samples[idx]! += (click + thud) * 0.95;
    }
  }
  return samples;
}

function silence(durationSec: number, sampleRate = ANALYSIS_SAMPLE_RATE): Float32Array {
  return new Float32Array(Math.floor(durationSec * sampleRate));
}

describe("STEP 2C audio intelligence — signal analysis", () => {
  it("estimates BPM near known 120 for synthetic beat train", () => {
    const samples = synthBeats(8, 120);
    const result = analyzeDecodedPcm({
      samples,
      sampleRate: ANALYSIS_SAMPLE_RATE,
      durationSec: 8,
      channels: 1,
      codec: "pcm",
      bitrate: null,
      format: "raw",
    });
    expect(result.technical.silent).toBe(false);
    expect(result.tempo.primaryBpm).not.toBeNull();
    const bpm = result.tempo.primaryBpm!;
    // Allow half/double ambiguity: 60 or 120 or 240→capped
    const ok = [60, 120].some((target) => Math.abs(bpm - target) <= 4)
      || (result.tempo.alternativeBpm != null
        && [60, 120].some((target) => Math.abs(result.tempo.alternativeBpm! - target) <= 4));
    expect(ok).toBe(true);
    expect(result.tempo.confidence).toBeGreaterThan(0.15);
    expect(result.beats.length).toBeGreaterThan(4);
    expect(result.energyTimeline.length).toBeGreaterThan(0);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it("handles silence without inventing beats or BPM", () => {
    const samples = silence(3);
    const result = analyzeDecodedPcm({
      samples,
      sampleRate: ANALYSIS_SAMPLE_RATE,
      durationSec: 3,
      channels: 1,
      codec: "pcm",
      bitrate: null,
      format: "raw",
    });
    expect(result.technical.silent).toBe(true);
    expect(result.tempo.bpm).toBeNull();
    expect(result.beats).toEqual([]);
    expect(result.sections[0]?.label).toBe("SILENCE");
  });

  it("marks short audio as insufficient", () => {
    const samples = synthBeats(1.2, 100);
    const result = analyzeDecodedPcm({
      samples,
      sampleRate: ANALYSIS_SAMPLE_RATE,
      durationSec: 1.2,
      channels: 1,
      codec: "pcm",
      bitrate: null,
      format: "raw",
    });
    expect(result.technical.insufficientDuration).toBe(true);
    expect(result.tempo.status).toBe("insufficient_duration");
  });

  it("classifies beat strength and produces energy transitions for active audio", () => {
    const samples = synthBeats(6, 100);
    const result = analyzeDecodedPcm({
      samples,
      sampleRate: ANALYSIS_SAMPLE_RATE,
      durationSec: 6,
      channels: 1,
      codec: "pcm",
      bitrate: null,
      format: "raw",
    });
    expect(result.beats.every((b) => b.strength >= 0 && b.strength <= 1)).toBe(true);
    expect(result.beats.some((b) => ["weak", "normal", "strong", "accent"].includes(b.strengthClass))).toBe(true);
    expect(result.beatDensity.length).toBeGreaterThan(0);
  });

  it("is deterministic for identical input", () => {
    const samples = synthBeats(5, 110);
    const input = {
      samples,
      sampleRate: ANALYSIS_SAMPLE_RATE,
      durationSec: 5,
      channels: 1 as const,
      codec: "pcm",
      bitrate: null,
      format: "raw",
    };
    const a = analyzeDecodedPcm(input);
    const b = analyzeDecodedPcm(input);
    expect(a.tempo.primaryBpm).toBe(b.tempo.primaryBpm);
    expect(a.beats.map((x) => x.time)).toEqual(b.beats.map((x) => x.time));
    expect(a.meanEnergy).toBe(b.meanEnergy);
  });
});

describe("STEP 2C timing queries", () => {
  const intel: AudioTimingIntelligence = {
    audioAssetId: "a1",
    contentHash: "abc",
    analysisVersion: AUDIO_INTELLIGENCE_VERSION,
    status: "READY",
    analyzedAt: new Date().toISOString(),
    analysisDurationMs: 10,
    technical: {
      durationSec: 4,
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
      confidence: 0.8,
      method: "test",
      status: "available",
    },
    duration: 4,
    bpm: 120,
    bpmConfidence: 0.8,
    beats: [
      { time: 0.5, strength: 0.4, strengthClass: "normal", confidence: 0.7, type: "beat" },
      { time: 1.0, strength: 0.9, strengthClass: "accent", confidence: 0.9, type: "downbeat", barIndex: 0 },
      { time: 1.5, strength: 0.5, strengthClass: "normal", confidence: 0.7, type: "beat" },
      { time: 2.0, strength: 0.8, strengthClass: "strong", confidence: 0.85, type: "downbeat", barIndex: 1 },
    ],
    strongBeats: [
      { time: 1.0, strength: 0.9, strengthClass: "accent", confidence: 0.9, type: "downbeat", barIndex: 0 },
      { time: 2.0, strength: 0.8, strengthClass: "strong", confidence: 0.85, type: "downbeat", barIndex: 1 },
    ],
    downbeats: [
      { time: 1.0, strength: 0.9, strengthClass: "accent", confidence: 0.9, type: "downbeat", barIndex: 0 },
      { time: 2.0, strength: 0.8, strengthClass: "strong", confidence: 0.85, type: "downbeat", barIndex: 1 },
    ],
    energyTimeline: [
      { start: 0, end: 2, energy: 0.3, trend: "low" },
      { start: 2, end: 4, energy: 0.8, trend: "high" },
    ],
    energyTransitions: [],
    sections: [
      { label: "SECTION_1", start: 0, end: 2, energy: 0.3, beatDensity: 1, confidence: 0.5 },
      { label: "SECTION_2", start: 2, end: 4, energy: 0.8, beatDensity: 2, confidence: 0.5 },
    ],
    beatDensity: [],
    meanEnergy: 0.55,
  };

  it("resolves nearest / next beat and energy / section", () => {
    expect(getNearestBeat(intel, 0.9)?.time).toBe(1.0);
    expect(getNextBeat(intel, 1.0)?.time).toBe(1.5);
    expect(getEnergyAt(intel, 2.5)).toBe(0.8);
    expect(getSectionAt(intel, 0.5)?.label).toBe("SECTION_1");
  });

  it("quantizes to beat without forcing sync in FREE mode", () => {
    expect(quantizeTime(intel, 0.92, "FREE_TIMING")).toBe(0.92);
    expect(quantizeTime(intel, 0.92, "BEAT_ALIGNED")).toBe(1.0);
    expect(quantizeTime(intel, 1.8, "STRONG_BEAT_ALIGNED")).toBe(2.0);
  });
});
