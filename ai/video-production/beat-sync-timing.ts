/**
 * STEP 2D — Beat-Synchronized Video Timing Planner.
 * Adjusts timeline clip durations using STEP 2C Audio Intelligence.
 * Does NOT rewrite the storyboard; does NOT invent beats.
 */
import type { BeatSyncMode } from "../creative-workspace/audio-asset.js";
import { normalizeBeatSyncMode } from "../creative-workspace/audio-asset.js";
import type { AudioTimingIntelligence } from "../audio-intelligence/types.js";
import {
  getEnergyAt,
  getNearestBeat,
  getNearestStrongBeat,
  getNextBeat,
  getNextStrongBeat,
} from "../audio-intelligence/timing-queries.js";
import type { VideoTimelineClip } from "./types.js";

export const BEAT_SYNC_VERSION = "beat-sync-v1";

export type { BeatSyncMode };
export { normalizeBeatSyncMode };

export type BeatSyncTimingSource =
  | "STORYBOARD"
  | "BEAT"
  | "STRONG_BEAT"
  | "DOWNBEAT"
  | "ENERGY"
  | "MANUAL"
  | "FALLBACK";

export type BeatSyncAlignmentType =
  | "NONE"
  | "NEAREST_BEAT"
  | "NEXT_BEAT"
  | "STRONG_BEAT"
  | "DOWNBEAT"
  | "ENERGY_PEAK"
  | "ENERGY_RISE"
  | "ENERGY_DROP";

export interface BeatSyncSceneTiming {
  sceneId: string;
  clipId: string;
  purpose: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  baseDurationMs: number;
  timingSource: BeatSyncTimingSource;
  alignedBeatTime: number | null;
  alignmentType: BeatSyncAlignmentType;
  confidence: number;
  transitionTime: number;
}

export interface BeatSyncTimingPlan {
  beatSyncVersion: typeof BEAT_SYNC_VERSION;
  mode: BeatSyncMode;
  audioAssetId: string | null;
  contentHash: string | null;
  analysisVersion: string | null;
  videoDurationMs: number;
  baseDurationMs: number;
  createdAt: string;
  message: string;
  scenes: BeatSyncSceneTiming[];
}

export interface BeatSyncApplyResult {
  clips: VideoTimelineClip[];
  plan: BeatSyncTimingPlan;
  changed: boolean;
}

const MIN_MS: Record<string, number> = {
  HOOK: 1200,
  INTRO: 1200,
  PRODUCT: 1800,
  REVEAL: 2000,
  FEATURE: 1600,
  BENEFIT: 1600,
  DETAIL: 1500,
  LIFESTYLE: 1600,
  PRICE: 2000,
  OFFER: 2000,
  CTA: 2200,
  END: 2500,
  ENDCARD: 2500,
  DEFAULT: 1400,
};

const MAX_MS: Record<string, number> = {
  HOOK: 4500,
  INTRO: 5000,
  PRODUCT: 7000,
  REVEAL: 6500,
  FEATURE: 6000,
  BENEFIT: 6000,
  DETAIL: 5500,
  LIFESTYLE: 7000,
  PRICE: 5000,
  OFFER: 5000,
  CTA: 5500,
  END: 8000,
  ENDCARD: 8000,
  DEFAULT: 6500,
};

function purposeKey(purpose: string): string {
  const p = purpose.toUpperCase();
  if (/END.?CARD|ENDCARD|CLOSING|BRAND/.test(p)) return "ENDCARD";
  if (/CTA|CALL.?TO.?ACTION|ORDER|SHOP/.test(p)) return "CTA";
  if (/PRICE|DISCOUNT|OFFER|SALE|PROMO/.test(p)) return "PRICE";
  if (/HOOK|OPEN|ATTENTION/.test(p)) return "HOOK";
  if (/REVEAL|HERO|PRODUCT/.test(p)) return "REVEAL";
  if (/FEATURE|SPEC/.test(p)) return "FEATURE";
  if (/BENEFIT/.test(p)) return "BENEFIT";
  if (/DETAIL|MACRO|CLOSE/.test(p)) return "DETAIL";
  if (/LIFESTYLE|CONTEXT/.test(p)) return "LIFESTYLE";
  return "DEFAULT";
}

function minDuration(purpose: string, hasText: boolean): number {
  const base = MIN_MS[purposeKey(purpose)] ?? MIN_MS.DEFAULT!;
  return hasText ? Math.max(base, base + 300) : base;
}

function maxDuration(purpose: string, mode: BeatSyncMode): number {
  const base = MAX_MS[purposeKey(purpose)] ?? MAX_MS.DEFAULT!;
  return mode === "STRICT" ? Math.round(base * 0.9) : base;
}

function wantsStrongAlignment(purpose: string): boolean {
  const key = purposeKey(purpose);
  return key === "HOOK" || key === "REVEAL" || key === "PRICE" || key === "CTA" || key === "ENDCARD";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function recompute(clips: VideoTimelineClip[]): VideoTimelineClip[] {
  let cursor = 0;
  return clips.map((clip, index) => {
    const next = { ...clip, order: index + 1, startMs: cursor };
    cursor += next.durationMs;
    return next;
  });
}

function storyboardPlan(
  clips: VideoTimelineClip[],
  mode: BeatSyncMode,
  message: string,
  audioMeta?: { audioAssetId: string | null; contentHash: string | null; analysisVersion: string | null },
): BeatSyncApplyResult {
  const timed = recompute(clips.map((c) => ({ ...c })));
  const scenes: BeatSyncSceneTiming[] = timed.map((clip) => ({
    sceneId: clip.sceneId,
    clipId: clip.id,
    purpose: clip.purpose,
    startMs: clip.startMs,
    endMs: clip.startMs + clip.durationMs,
    durationMs: clip.durationMs,
    baseDurationMs: clip.durationMs,
    timingSource: "STORYBOARD",
    alignedBeatTime: null,
    alignmentType: "NONE",
    confidence: 1,
    transitionTime: (clip.startMs + clip.durationMs) / 1000,
  }));
  return {
    clips: timed,
    changed: false,
    plan: {
      beatSyncVersion: BEAT_SYNC_VERSION,
      mode,
      audioAssetId: audioMeta?.audioAssetId ?? null,
      contentHash: audioMeta?.contentHash ?? null,
      analysisVersion: audioMeta?.analysisVersion ?? null,
      videoDurationMs: scenes.reduce((s, x) => s + x.durationMs, 0),
      baseDurationMs: scenes.reduce((s, x) => s + x.baseDurationMs, 0),
      createdAt: new Date().toISOString(),
      message,
      scenes,
    },
  };
}

interface Candidate {
  timeSec: number;
  type: BeatSyncAlignmentType;
  source: BeatSyncTimingSource;
  score: number;
  confidence: number;
}

function scoreCandidate(input: {
  desiredEndSec: number;
  candTime: number;
  mode: BeatSyncMode;
  purpose: string;
  beatStrength: number;
  energy: number;
  windowSec: number;
}): number | null {
  const delta = Math.abs(input.candTime - input.desiredEndSec);
  if (delta > input.windowSec) return null;
  const proximity = 1 - delta / input.windowSec;
  const importance = wantsStrongAlignment(input.purpose) ? 1.15 : 1;
  const energyBonus = input.energy > 0.65 ? 0.08 : input.energy < 0.3 ? -0.05 : 0;
  const modeBoost = input.mode === "STRICT" ? 0.1 : 0;
  return proximity * 0.55 + input.beatStrength * 0.3 * importance + energyBonus + modeBoost;
}

/**
 * Apply beat-sync timing to a timeline.
 * Preserves clip identity/order/assets; only durationMs (+ startMs recompute) change.
 * Respects userEdited clips (locked).
 */
export function applyBeatSyncTiming(input: {
  clips: VideoTimelineClip[];
  mode: BeatSyncMode;
  intelligence: AudioTimingIntelligence | null;
  audioAssetId?: string | null;
}): BeatSyncApplyResult {
  const mode = input.mode ?? "OFF";
  const clips = input.clips.map((c) => ({ ...c }));
  const audioMeta = {
    audioAssetId: input.audioAssetId ?? input.intelligence?.audioAssetId ?? null,
    contentHash: input.intelligence?.contentHash ?? null,
    analysisVersion: input.intelligence?.analysisVersion ?? null,
  };

  if (mode === "OFF") {
    return storyboardPlan(clips, "OFF", "Beat sync off — storyboard timing used.", audioMeta);
  }

  const intel = input.intelligence;
  if (!intel || intel.status !== "READY") {
    return storyboardPlan(clips, mode, "Audio analysis unavailable — storyboard timing used.", audioMeta);
  }
  if (intel.technical.silent || !intel.beats.length) {
    return storyboardPlan(clips, mode, "No meaningful beats — storyboard timing used.", audioMeta);
  }
  if (intel.bpmConfidence < 0.2 && mode === "SMART") {
    return storyboardPlan(clips, mode, "Low-confidence rhythm — storyboard timing used.", audioMeta);
  }

  const windowSec = mode === "STRICT" ? 0.55 : 0.38;
  const aggressiveness = mode === "STRICT" ? 0.85 : 0.55;
  const scenesOut: BeatSyncSceneTiming[] = [];
  let cursorMs = 0;
  let changed = false;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]!;
    const baseDuration = clip.durationMs;
    const hasText = (clip.text?.length ?? 0) > 0;
    const minMs = minDuration(clip.purpose, hasText);
    const maxMs = maxDuration(clip.purpose, mode);
    const remaining = clips.slice(i + 1);
    const remainingMin = remaining.reduce((sum, c) => {
      if (c.userEdited) return sum + c.durationMs;
      return sum + minDuration(c.purpose, (c.text?.length ?? 0) > 0);
    }, 0);
    const audioLimitMs = Math.round(intel.duration * 1000);
    // Keep room for remaining mins; do not require filling entire audio
    const hardMaxEnd = Math.max(cursorMs + minMs, audioLimitMs > 0 ? audioLimitMs : cursorMs + maxMs);

    if (clip.userEdited) {
      const durationMs = clamp(clip.durationMs, 800, 15000);
      const startMs = cursorMs;
      cursorMs += durationMs;
      clips[i] = { ...clip, startMs, durationMs };
      scenesOut.push({
        sceneId: clip.sceneId,
        clipId: clip.id,
        purpose: clip.purpose,
        startMs,
        endMs: startMs + durationMs,
        durationMs,
        baseDurationMs: baseDuration,
        timingSource: "MANUAL",
        alignedBeatTime: null,
        alignmentType: "NONE",
        confidence: 1,
        transitionTime: (startMs + durationMs) / 1000,
      });
      continue;
    }

    const desiredEndSec = (cursorMs + baseDuration) / 1000;
    const candidates: Candidate[] = [];

    const preferStrong = wantsStrongAlignment(clip.purpose) || mode === "STRICT";
    const nearestStrong = getNearestStrongBeat(intel, desiredEndSec);
    const nextStrong = getNextStrongBeat(intel, cursorMs / 1000 + minMs / 1000);
    const nearest = getNearestBeat(intel, desiredEndSec);
    const next = getNextBeat(intel, cursorMs / 1000 + minMs / 1000);

    const pushCand = (
      beat: { time: number; strength: number; confidence: number; type?: string } | null,
      type: BeatSyncAlignmentType,
      source: BeatSyncTimingSource,
    ) => {
      if (!beat) return;
      const energy = getEnergyAt(intel, beat.time);
      const score = scoreCandidate({
        desiredEndSec,
        candTime: beat.time,
        mode,
        purpose: clip.purpose,
        beatStrength: beat.strength,
        energy,
        windowSec: preferStrong && source === "STRONG_BEAT" ? windowSec * 1.25 : windowSec,
      });
      if (score == null) return;
      candidates.push({
        timeSec: beat.time,
        type,
        source,
        score,
        confidence: beat.confidence,
      });
    };

    if (preferStrong) {
      pushCand(nearestStrong, "STRONG_BEAT", "STRONG_BEAT");
      pushCand(nextStrong, "STRONG_BEAT", "STRONG_BEAT");
      if (intel.downbeats.length) {
        const nd = intel.downbeats.reduce((best, b) =>
          !best || Math.abs(b.time - desiredEndSec) < Math.abs(best.time - desiredEndSec) ? b : best, intel.downbeats[0]!);
        pushCand(nd, "DOWNBEAT", "DOWNBEAT");
      }
    }
    pushCand(nearest, "NEAREST_BEAT", "BEAT");
    pushCand(next, "NEXT_BEAT", "BEAT");

    // Energy peaks / rises / drops near desired end
    for (const tr of intel.energyTransitions) {
      if (tr.type !== "ENERGY_RISE" && tr.type !== "ENERGY_PEAK" && tr.type !== "ENERGY_DROP") continue;
      const score = scoreCandidate({
        desiredEndSec,
        candTime: tr.time,
        mode,
        purpose: clip.purpose,
        beatStrength: 0.55,
        energy: tr.toEnergy,
        windowSec: windowSec * 1.1,
      });
      if (score == null) continue;
      candidates.push({
        timeSec: tr.time,
        type: tr.type === "ENERGY_PEAK"
          ? "ENERGY_PEAK"
          : tr.type === "ENERGY_DROP"
            ? "ENERGY_DROP"
            : "ENERGY_RISE",
        source: "ENERGY",
        score: score * 0.9,
        confidence: 0.55,
      });
    }

    candidates.sort((a, b) => b.score - a.score);

    let chosen: Candidate | null = null;
    for (const cand of candidates) {
      const endMs = Math.round(cand.timeSec * 1000);
      const durationMs = endMs - cursorMs;
      if (durationMs < minMs) continue;
      if (durationMs > maxMs) continue;
      if (endMs + remainingMin > hardMaxEnd + 2500 && i < clips.length - 1) {
        // leave room for later scenes when possible
        if (mode === "SMART") continue;
      }
      // Avoid tiny residual for next scene
      if (i < clips.length - 1) {
        const nextMin = minDuration(clips[i + 1]!.purpose, (clips[i + 1]!.text?.length ?? 0) > 0);
        if (hardMaxEnd - endMs < nextMin * 0.5 && hardMaxEnd - cursorMs > minMs + nextMin) {
          continue;
        }
      }
      if (cand.score < (mode === "STRICT" ? 0.25 : 0.4) * aggressiveness + 0.15) continue;
      chosen = cand;
      break;
    }

    let durationMs = baseDuration;
    let timingSource: BeatSyncTimingSource = "STORYBOARD";
    let alignmentType: BeatSyncAlignmentType = "NONE";
    let alignedBeatTime: number | null = null;
    let confidence = 1;

    if (chosen) {
      durationMs = Math.round(chosen.timeSec * 1000) - cursorMs;
      timingSource = chosen.source;
      alignmentType = chosen.type;
      alignedBeatTime = chosen.timeSec;
      confidence = chosen.confidence;
      if (Math.abs(durationMs - baseDuration) >= 40) changed = true;
    } else {
      // Soft energy-aware stretch/shrink within bounds (no fake beats)
      const midEnergy = getEnergyAt(intel, (cursorMs + baseDuration / 2) / 1000);
      if (mode === "STRICT" && midEnergy > 0.7 && baseDuration > minMs + 200) {
        durationMs = Math.max(minMs, Math.round(baseDuration * 0.92));
        timingSource = "ENERGY";
        alignmentType = "ENERGY_RISE";
        if (durationMs !== baseDuration) changed = true;
      } else if (midEnergy < 0.28 && baseDuration < maxMs - 200) {
        durationMs = Math.min(maxMs, Math.round(baseDuration * 1.08));
        timingSource = "ENERGY";
        alignmentType = "NONE";
        if (durationMs !== baseDuration) changed = true;
      }
      confidence = intel.bpmConfidence;
    }

    durationMs = clamp(durationMs, minMs, maxMs);
    // Last scene: do not invent looping beyond audio; clamp end if needed
    if (i === clips.length - 1 && audioLimitMs > cursorMs + minMs) {
      // keep planned duration; mux will trim audio
    }

    const startMs = cursorMs;
    cursorMs += durationMs;
    clips[i] = { ...clip, startMs, durationMs };
    scenesOut.push({
      sceneId: clip.sceneId,
      clipId: clip.id,
      purpose: clip.purpose,
      startMs,
      endMs: startMs + durationMs,
      durationMs,
      baseDurationMs: baseDuration,
      timingSource,
      alignedBeatTime,
      alignmentType,
      confidence,
      transitionTime: (startMs + durationMs) / 1000,
    });
  }

  const timed = recompute(clips);
  // Align scene starts with recomputed clips
  for (let i = 0; i < timed.length; i++) {
    const s = scenesOut[i];
    const c = timed[i]!;
    if (!s) continue;
    s.startMs = c.startMs;
    s.durationMs = c.durationMs;
    s.endMs = c.startMs + c.durationMs;
    s.transitionTime = s.endMs / 1000;
  }

  return {
    clips: timed,
    changed,
    plan: {
      beatSyncVersion: BEAT_SYNC_VERSION,
      mode,
      audioAssetId: audioMeta.audioAssetId,
      contentHash: audioMeta.contentHash,
      analysisVersion: audioMeta.analysisVersion,
      videoDurationMs: timed.reduce((s, c) => s + c.durationMs, 0),
      baseDurationMs: input.clips.reduce((s, c) => s + c.durationMs, 0),
      createdAt: new Date().toISOString(),
      message: changed
        ? `Beat sync ${mode} adjusted scene timing.`
        : `Beat sync ${mode} kept storyboard pacing (no safe alignment found).`,
      scenes: scenesOut,
    },
  };
}

export function beatSyncCacheKey(input: {
  projectId: string;
  audioAssetId: string | null;
  contentHash: string | null;
  analysisVersion: string | null;
  creativePlanVersion: number;
  targetDurationMs: number;
  aspectRatio: string;
  mode: BeatSyncMode;
}): string {
  return [
    input.projectId,
    input.audioAssetId ?? "none",
    input.contentHash ?? "none",
    input.analysisVersion ?? "none",
    `plan-v${input.creativePlanVersion}`,
    `dur-${input.targetDurationMs}`,
    input.aspectRatio,
    input.mode,
    BEAT_SYNC_VERSION,
  ].join("|");
}
