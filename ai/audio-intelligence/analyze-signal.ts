/**
 * Deterministic PCM signal analysis: onset, BPM, beats, energy, sections.
 * No external music libraries — pure TypeScript for VPS-safe deployment.
 */
import type {
  AudioBeatDensityWindow,
  AudioBeatEvent,
  AudioEnergyTransition,
  AudioEnergyWindow,
  AudioSection,
  AudioSectionLabel,
  BeatStrengthClass,
  TechnicalAudioAnalysis,
  TempoAnalysis,
} from "./types.js";
import type { DecodedPcm } from "./pcm-decode.js";

const HOP = 512;
const MIN_BPM = 60;
const MAX_BPM = 180;
const MIN_RELIABLE_SEC = 2.5;
const SILENCE_RMS = 0.008;

export interface SignalAnalysisResult {
  technical: TechnicalAudioAnalysis;
  tempo: TempoAnalysis;
  beats: AudioBeatEvent[];
  strongBeats: AudioBeatEvent[];
  downbeats: AudioBeatEvent[];
  energyTimeline: AudioEnergyWindow[];
  energyTransitions: AudioEnergyTransition[];
  sections: AudioSection[];
  beatDensity: AudioBeatDensityWindow[];
  meanEnergy: number;
}

function rms(samples: Float32Array, start: number, end: number): number {
  let sum = 0;
  const n = Math.max(1, end - start);
  for (let i = start; i < end; i++) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / n);
}

function classifyStrength(strength: number): BeatStrengthClass {
  if (strength >= 0.85) return "accent";
  if (strength >= 0.65) return "strong";
  if (strength >= 0.35) return "normal";
  return "weak";
}

/** Frame-wise onset strength via half-wave rectified energy flux. */
function computeOnsetEnvelope(samples: Float32Array, sampleRate: number): {
  onset: Float32Array;
  frameTimes: Float32Array;
  frameRms: Float32Array;
} {
  const frameCount = Math.max(1, Math.floor((samples.length - HOP) / HOP));
  const onset = new Float32Array(frameCount);
  const frameTimes = new Float32Array(frameCount);
  const frameRms = new Float32Array(frameCount);
  let prevEnergy = 0;
  for (let f = 0; f < frameCount; f++) {
    const start = f * HOP;
    const end = Math.min(samples.length, start + HOP);
    let energySum = 0;
    let peak = 0;
    const n = Math.max(1, end - start);
    for (let i = start; i < end; i++) {
      const v = Math.abs(samples[i] ?? 0);
      energySum += v * v;
      if (v > peak) peak = v;
    }
    const energy = Math.sqrt(energySum / n);
    // Blend RMS + peak so sharp percussive hits register as onsets
    const frameEnergy = energy * 0.55 + peak * 0.45;
    frameRms[f] = frameEnergy;
    frameTimes[f] = (start + HOP / 2) / sampleRate;
    const flux = Math.max(0, frameEnergy - prevEnergy);
    onset[f] = flux;
    prevEnergy = frameEnergy * 0.7 + prevEnergy * 0.3;
  }
  // Normalize onset
  let max = 0;
  for (let i = 0; i < onset.length; i++) max = Math.max(max, onset[i]!);
  if (max > 1e-9) {
    for (let i = 0; i < onset.length; i++) onset[i]! /= max;
  }
  return { onset, frameTimes, frameRms };
}

function estimateTempo(onset: Float32Array, sampleRate: number): TempoAnalysis {
  const fps = sampleRate / HOP;
  const minLag = Math.round((60 / MAX_BPM) * fps);
  const maxLag = Math.round((60 / MIN_BPM) * fps);
  if (onset.length < maxLag + 8) {
    return {
      bpm: null,
      primaryBpm: null,
      alternativeBpm: null,
      confidence: 0,
      method: "autocorr-onset-v1",
      status: "insufficient_duration",
    };
  }

  const scores = new Float32Array(maxLag + 1);
  let bestLag = minLag;
  let bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i + lag < onset.length; i++) {
      sum += onset[i]! * onset[i + lag]!;
      count += 1;
    }
    const score = count ? sum / count : 0;
    scores[lag] = score;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  // Secondary peak near half/double for ambiguity reporting
  let altLag = bestLag;
  let altScore = -1;
  const half = Math.round(bestLag / 2);
  const dbl = bestLag * 2;
  for (const candidate of [half, dbl, Math.round(bestLag * 2 / 3), Math.round(bestLag * 3 / 2)]) {
    if (candidate < minLag || candidate > maxLag) continue;
    const s = scores[candidate] ?? 0;
    if (s > altScore && candidate !== bestLag) {
      altScore = s;
      altLag = candidate;
    }
  }

  const primaryBpm = Math.round((60 * fps / bestLag) * 10) / 10;
  const alternativeBpm = altLag !== bestLag
    ? Math.round((60 * fps / altLag) * 10) / 10
    : null;

  // Confidence from peak prominence vs mean + second-best lag
  let mean = 0;
  let n = 0;
  let second = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const s = scores[lag]!;
    mean += s;
    n += 1;
    if (lag !== bestLag && s > second) second = s;
  }
  mean = n ? mean / n : 0;
  const prominence = bestScore - mean;
  const peakRatio = bestScore > 1e-9 ? (bestScore - second) / bestScore : 0;
  let confidence = Math.max(0, Math.min(1, prominence * 5 + peakRatio * 0.35));
  // Penalize if half/double nearly as strong
  if (alternativeBpm != null && bestScore > 0 && altScore / bestScore > 0.9) {
    confidence *= 0.78;
  }
  // Floor confidence when a clear peak exists above noise
  if (bestScore > mean * 2.2 && confidence < 0.2) confidence = 0.22;

  const status: TempoAnalysis["status"] = confidence < 0.15
    ? "unavailable"
    : confidence < 0.35
      ? "low_confidence"
      : "available";

  return {
    bpm: status === "unavailable" ? null : primaryBpm,
    primaryBpm: status === "unavailable" ? null : primaryBpm,
    alternativeBpm,
    confidence: Math.round(confidence * 1000) / 1000,
    method: "autocorr-onset-v1",
    status,
    tempoRange: { min: MIN_BPM, max: MAX_BPM },
  };
}

function pickBeats(
  onset: Float32Array,
  frameTimes: Float32Array,
  bpm: number | null,
  confidence: number,
): AudioBeatEvent[] {
  if (!onset.length) return [];
  const beats: AudioBeatEvent[] = [];

  // Local maxima with adaptive threshold
  let mean = 0;
  for (let i = 0; i < onset.length; i++) mean += onset[i]!;
  mean /= onset.length;
  const threshold = Math.max(0.08, mean * 1.15);

  const minGapFrames = bpm && bpm > 0
    ? Math.max(2, Math.round((60 / bpm) * (ANALYSIS_FPS()) * 0.45))
    : Math.max(3, Math.round(0.18 * ANALYSIS_FPS()));

  let lastPick = -minGapFrames;
  for (let i = 1; i < onset.length - 1; i++) {
    const v = onset[i]!;
    if (v < threshold) continue;
    if (v < onset[i - 1]! || v < onset[i + 1]!) continue;
    if (i - lastPick < minGapFrames) {
      // Keep stronger peak
      if (beats.length && v > beats[beats.length - 1]!.strength) {
        beats[beats.length - 1] = makeBeat(frameTimes[i]!, v, confidence);
        lastPick = i;
      }
      continue;
    }
    beats.push(makeBeat(frameTimes[i]!, v, confidence));
    lastPick = i;
  }

  // If BPM known, snap/fill onto a tempo grid from the first detection
  if (bpm && bpm > 40 && beats.length >= 1) {
    return refineWithTempoGrid(beats, bpm, confidence, frameTimes[frameTimes.length - 1] ?? beats[beats.length - 1]!.time);
  }
  return beats;
}

function ANALYSIS_FPS(): number {
  return 22050 / HOP;
}

function makeBeat(time: number, strength: number, tempoConfidence: number): AudioBeatEvent {
  const s = Math.max(0, Math.min(1, strength));
  return {
    time: Math.round(time * 1000) / 1000,
    strength: Math.round(s * 1000) / 1000,
    strengthClass: classifyStrength(s),
    confidence: Math.round(Math.min(1, tempoConfidence * 0.5 + s * 0.5) * 1000) / 1000,
    type: "beat",
  };
}

function refineWithTempoGrid(
  detected: AudioBeatEvent[],
  bpm: number,
  confidence: number,
  duration: number,
): AudioBeatEvent[] {
  const interval = 60 / bpm;
  const start = detected[0]!.time;
  const out: AudioBeatEvent[] = [];
  // Map each grid beat to nearest detection within 30% of interval
  const window = interval * 0.3;
  for (let t = start; t <= duration + 1e-6; t += interval) {
    let best: AudioBeatEvent | null = null;
    let bestDist = Infinity;
    for (const b of detected) {
      const d = Math.abs(b.time - t);
      if (d < bestDist && d <= window) {
        bestDist = d;
        best = b;
      }
    }
    if (best) {
      out.push({ ...best, time: Math.round(best.time * 1000) / 1000 });
    } else if (confidence >= 0.2) {
      // Place tempo-grid beat when tempo estimate exists (not random — from BPM interval)
      out.push(makeBeat(t, 0.32, confidence * 0.65));
    }
  }
  // Deduplicate by time
  const deduped: AudioBeatEvent[] = [];
  for (const b of out.sort((a, c) => a.time - c.time)) {
    if (!deduped.length || b.time - deduped[deduped.length - 1]!.time > interval * 0.4) {
      deduped.push(b);
    } else if (b.strength > deduped[deduped.length - 1]!.strength) {
      deduped[deduped.length - 1] = b;
    }
  }
  return deduped;
}

function assignDownbeats(beats: AudioBeatEvent[], bpm: number | null, confidence: number): AudioBeatEvent[] {
  if (!bpm || confidence < 0.5 || beats.length < 4) {
    return beats.map((b) => ({ ...b, type: "beat" as const }));
  }
  // Prefer 4/4: every 4th beat from strongest early beat as bar start
  const search = beats.slice(0, Math.min(8, beats.length));
  let bestStart = 0;
  let bestScore = -1;
  for (let offset = 0; offset < 4; offset++) {
    let score = 0;
    let count = 0;
    for (let i = offset; i < beats.length; i += 4) {
      score += beats[i]!.strength;
      count += 1;
    }
    const avg = count ? score / count : 0;
    if (avg > bestScore) {
      bestScore = avg;
      bestStart = offset;
    }
  }
  return beats.map((b, i) => {
    const beatInBar = ((i - bestStart) % 4 + 4) % 4;
    const barIndex = Math.floor((i - bestStart) / 4);
    const isDown = beatInBar === 0 && i >= bestStart;
    return {
      ...b,
      type: isDown ? "downbeat" as const : "beat" as const,
      barIndex: isDown ? Math.max(0, barIndex) : undefined,
      beatInBar,
      confidence: isDown ? Math.min(1, b.confidence * 0.9) : b.confidence,
    };
  });
}

function buildEnergyTimeline(frameRms: Float32Array, frameTimes: Float32Array): {
  timeline: AudioEnergyWindow[];
  transitions: AudioEnergyTransition[];
  meanEnergy: number;
} {
  if (!frameRms.length) {
    return { timeline: [], transitions: [], meanEnergy: 0 };
  }
  let max = 0;
  let sum = 0;
  for (let i = 0; i < frameRms.length; i++) {
    max = Math.max(max, frameRms[i]!);
    sum += frameRms[i]!;
  }
  const meanEnergy = max > 1e-9 ? (sum / frameRms.length) / max : 0;
  const windowSec = 0.5;
  const timeline: AudioEnergyWindow[] = [];
  let i = 0;
  while (i < frameTimes.length) {
    const startT = frameTimes[i]!;
    const endTarget = startT + windowSec;
    let j = i;
    let eSum = 0;
    let count = 0;
    while (j < frameTimes.length && frameTimes[j]! < endTarget) {
      eSum += max > 1e-9 ? frameRms[j]! / max : 0;
      count += 1;
      j += 1;
    }
    if (j === i) j = i + 1;
    const energy = count ? eSum / count : 0;
    const end = frameTimes[Math.min(j, frameTimes.length) - 1]! + HOP / 22050;
    timeline.push({
      start: Math.round(startT * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
      energy: Math.round(energy * 1000) / 1000,
    });
    i = j;
  }

  // Trends + transitions
  for (let k = 0; k < timeline.length; k++) {
    const prev = timeline[k - 1]?.energy ?? timeline[k]!.energy;
    const next = timeline[k + 1]?.energy ?? timeline[k]!.energy;
    const cur = timeline[k]!.energy;
    const rise = cur - prev;
    const fall = next - cur;
    if (cur < 0.25) timeline[k]!.trend = "low";
    else if (cur > 0.7) timeline[k]!.trend = "high";
    else if (rise > 0.12) timeline[k]!.trend = "rising";
    else if (fall < -0.12) timeline[k]!.trend = "falling";
    else timeline[k]!.trend = "stable";
  }

  const transitions: AudioEnergyTransition[] = [];
  for (let k = 1; k < timeline.length; k++) {
    const from = timeline[k - 1]!;
    const to = timeline[k]!;
    const delta = to.energy - from.energy;
    if (delta >= 0.18) {
      transitions.push({
        time: to.start,
        type: to.energy > 0.75 ? "ENERGY_PEAK" : "ENERGY_RISE",
        fromEnergy: from.energy,
        toEnergy: to.energy,
      });
    } else if (delta <= -0.18) {
      transitions.push({
        time: to.start,
        type: "ENERGY_DROP",
        fromEnergy: from.energy,
        toEnergy: to.energy,
      });
    } else if (Math.abs(delta) < 0.05 && k % 4 === 0) {
      transitions.push({
        time: to.start,
        type: "ENERGY_STABLE",
        fromEnergy: from.energy,
        toEnergy: to.energy,
      });
    }
  }

  return { timeline, transitions, meanEnergy: Math.round(meanEnergy * 1000) / 1000 };
}

function buildBeatDensity(beats: AudioBeatEvent[], duration: number): AudioBeatDensityWindow[] {
  const window = 2;
  const out: AudioBeatDensityWindow[] = [];
  for (let start = 0; start < duration; start += window) {
    const end = Math.min(duration, start + window);
    const count = beats.filter((b) => b.time >= start && b.time < end).length;
    const bps = (end - start) > 0 ? count / (end - start) : 0;
    out.push({
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
      beatsPerSecond: Math.round(bps * 1000) / 1000,
      density: bps < 1.2 ? "sparse" : bps > 2.8 ? "dense" : "normal",
    });
  }
  return out;
}

function buildSections(
  energy: AudioEnergyWindow[],
  beats: AudioBeatEvent[],
  duration: number,
  silent: boolean,
  insufficient: boolean,
): AudioSection[] {
  if (silent) {
    return [{
      label: "SILENCE",
      start: 0,
      end: Math.round(duration * 1000) / 1000,
      energy: 0,
      beatDensity: 0,
      confidence: 1,
    }];
  }
  if (insufficient || energy.length < 2) {
    return [{
      label: "INSUFFICIENT",
      start: 0,
      end: Math.round(duration * 1000) / 1000,
      energy: energy[0]?.energy ?? 0,
      beatDensity: 0,
      confidence: 0.2,
    }];
  }

  // Cluster contiguous energy levels into neutral SECTION_n (no hallucinated chorus/drop)
  const sections: AudioSection[] = [];
  let idx = 0;
  let curStart = energy[0]!.start;
  let curEnd = energy[0]!.end;
  let eSum = energy[0]!.energy;
  let eCount = 1;
  let level = energy[0]!.energy < 0.33 ? 0 : energy[0]!.energy < 0.66 ? 1 : 2;

  const flush = () => {
    idx += 1;
    const label = (`SECTION_${Math.min(5, idx)}` as AudioSectionLabel);
    const beatDensity = beats.filter((b) => b.time >= curStart && b.time < curEnd).length
      / Math.max(0.001, curEnd - curStart);
    sections.push({
      label,
      start: Math.round(curStart * 1000) / 1000,
      end: Math.round(curEnd * 1000) / 1000,
      energy: Math.round((eSum / eCount) * 1000) / 1000,
      beatDensity: Math.round(beatDensity * 1000) / 1000,
      confidence: 0.55,
    });
  };

  for (let i = 1; i < energy.length; i++) {
    const e = energy[i]!;
    const lvl = e.energy < 0.33 ? 0 : e.energy < 0.66 ? 1 : 2;
    if (lvl !== level && (e.start - curStart) >= 1.2) {
      flush();
      curStart = e.start;
      curEnd = e.end;
      eSum = e.energy;
      eCount = 1;
      level = lvl;
    } else {
      curEnd = e.end;
      eSum += e.energy;
      eCount += 1;
    }
  }
  flush();
  return sections;
}

export function analyzeDecodedPcm(pcm: DecodedPcm): SignalAnalysisResult {
  const { samples, sampleRate, durationSec } = pcm;
  const overallRms = rms(samples, 0, samples.length);
  const silent = overallRms < SILENCE_RMS || durationSec < 0.15;
  const insufficient = durationSec < MIN_RELIABLE_SEC;

  const technical: TechnicalAudioAnalysis = {
    durationSec: Math.round(durationSec * 1000) / 1000,
    sampleRate,
    channels: 1,
    codec: pcm.codec,
    bitrate: pcm.bitrate,
    format: pcm.format,
    silent,
    insufficientDuration: insufficient,
  };

  if (silent) {
    const emptyTempo: TempoAnalysis = {
      bpm: null,
      primaryBpm: null,
      alternativeBpm: null,
      confidence: 0,
      method: "autocorr-onset-v1",
      status: "unavailable",
    };
    return {
      technical,
      tempo: emptyTempo,
      beats: [],
      strongBeats: [],
      downbeats: [],
      energyTimeline: [{ start: 0, end: technical.durationSec, energy: 0, trend: "low" }],
      energyTransitions: [],
      sections: buildSections([], [], durationSec, true, false),
      beatDensity: [],
      meanEnergy: 0,
    };
  }

  const { onset, frameTimes, frameRms } = computeOnsetEnvelope(samples, sampleRate);
  const tempo = insufficient
    ? {
      bpm: null,
      primaryBpm: null,
      alternativeBpm: null,
      confidence: 0,
      method: "autocorr-onset-v1",
      status: "insufficient_duration" as const,
    }
    : estimateTempo(onset, sampleRate);

  // Speech-like: high energy variance with weak tempo → lower confidence already handled
  let beats = pickBeats(onset, frameTimes, tempo.primaryBpm, tempo.confidence);
  if (tempo.status === "unavailable" || tempo.status === "insufficient_duration") {
    // Keep only strong onsets as tentative beats without claiming BPM
    beats = beats.filter((b) => b.strength >= 0.55).map((b) => ({
      ...b,
      confidence: Math.min(b.confidence, 0.35),
    }));
  }

  beats = assignDownbeats(beats, tempo.primaryBpm, tempo.confidence);
  const strongBeats = beats.filter((b) => b.strengthClass === "strong" || b.strengthClass === "accent");
  const downbeats = beats.filter((b) => b.type === "downbeat");

  const { timeline, transitions, meanEnergy } = buildEnergyTimeline(frameRms, frameTimes);
  const beatDensity = buildBeatDensity(beats, durationSec);
  const sections = buildSections(timeline, beats, durationSec, false, insufficient);

  return {
    technical,
    tempo,
    beats,
    strongBeats,
    downbeats: tempo.confidence >= 0.5 ? downbeats : [],
    energyTimeline: timeline,
    energyTransitions: transitions,
    sections,
    beatDensity,
    meanEnergy,
  };
}
