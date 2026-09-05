/**
 * Timing query helpers — consume cached AudioTimingIntelligence without re-analysis.
 */
import type { AudioBeatEvent, AudioEnergyWindow, AudioSection, AudioTimingIntelligence } from "./types.js";

export function getNearestBeat(intel: AudioTimingIntelligence, time: number): AudioBeatEvent | null {
  return nearest(intel.beats, time);
}

export function getNextBeat(intel: AudioTimingIntelligence, time: number): AudioBeatEvent | null {
  return intel.beats.find((b) => b.time > time + 1e-6) ?? null;
}

export function getPreviousBeat(intel: AudioTimingIntelligence, time: number): AudioBeatEvent | null {
  for (let i = intel.beats.length - 1; i >= 0; i--) {
    if (intel.beats[i]!.time < time - 1e-6) return intel.beats[i]!;
  }
  return null;
}

export function getNearestStrongBeat(intel: AudioTimingIntelligence, time: number): AudioBeatEvent | null {
  return nearest(intel.strongBeats.length ? intel.strongBeats : intel.beats.filter((b) => b.strength >= 0.65), time);
}

export function getNextStrongBeat(intel: AudioTimingIntelligence, time: number): AudioBeatEvent | null {
  const list = intel.strongBeats.length
    ? intel.strongBeats
    : intel.beats.filter((b) => b.strength >= 0.65);
  return list.find((b) => b.time > time + 1e-6) ?? null;
}

export function getEnergyAt(intel: AudioTimingIntelligence, time: number): number {
  const w = intel.energyTimeline.find((e) => time >= e.start && time < e.end)
    ?? intel.energyTimeline[intel.energyTimeline.length - 1];
  return w?.energy ?? 0;
}

export function getEnergyPeak(
  intel: AudioTimingIntelligence,
  start: number,
  end: number,
): AudioEnergyWindow | null {
  let best: AudioEnergyWindow | null = null;
  for (const w of intel.energyTimeline) {
    if (w.end < start || w.start > end) continue;
    if (!best || w.energy > best.energy) best = w;
  }
  return best;
}

export function getSectionAt(intel: AudioTimingIntelligence, time: number): AudioSection | null {
  return intel.sections.find((s) => time >= s.start && time < s.end)
    ?? intel.sections[intel.sections.length - 1]
    ?? null;
}

/** Snap a free time to the nearest beat / strong beat / downbeat (foundation for future sync). */
export function quantizeTime(
  intel: AudioTimingIntelligence,
  time: number,
  mode: "FREE_TIMING" | "BEAT_ALIGNED" | "STRONG_BEAT_ALIGNED" | "DOWNBEAT_ALIGNED",
): number {
  if (mode === "FREE_TIMING") return time;
  const list = mode === "DOWNBEAT_ALIGNED"
    ? intel.downbeats
    : mode === "STRONG_BEAT_ALIGNED"
      ? (intel.strongBeats.length ? intel.strongBeats : intel.beats)
      : intel.beats;
  const hit = nearest(list, time);
  return hit ? hit.time : time;
}

function nearest(list: AudioBeatEvent[], time: number): AudioBeatEvent | null {
  if (!list.length) return null;
  let best = list[0]!;
  let bestDist = Math.abs(best.time - time);
  for (let i = 1; i < list.length; i++) {
    const d = Math.abs(list[i]!.time - time);
    if (d < bestDist) {
      bestDist = d;
      best = list[i]!;
    }
  }
  return best;
}
