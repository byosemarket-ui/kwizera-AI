/**
 * STEP 2F — Audio energy → visual energy mapping.
 * Does not invent energy when AudioTimeline is missing.
 */
import type { AudioTimingIntelligence } from "../audio-intelligence/types.js";
import type { VisualEnergyBand, VisualEnergyProfile } from "./types.js";

export function energyBand(energy: number): VisualEnergyBand {
  if (energy < 0.2) return "very_calm";
  if (energy < 0.4) return "calm";
  if (energy < 0.6) return "balanced";
  if (energy < 0.8) return "energetic";
  return "peak";
}

export function buildVisualEnergyProfile(
  intel: AudioTimingIntelligence | null | undefined,
): VisualEnergyProfile {
  if (!intel || intel.status !== "READY" || !Array.isArray(intel.energyTimeline) || !intel.energyTimeline.length) {
    return {
      version: "visual-energy-v1",
      samples: [],
      meanEnergy: null,
      peakEnergy: null,
      source: intel ? "FALLBACK" : "UNAVAILABLE",
    };
  }
  const samples = intel.energyTimeline.map((w) => ({
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
    energy: clamp01(w.energy),
    band: energyBand(clamp01(w.energy)),
  }));
  const energies = samples.map((s) => s.energy);
  return {
    version: "visual-energy-v1",
    samples,
    meanEnergy: typeof intel.meanEnergy === "number" ? clamp01(intel.meanEnergy) : average(energies),
    peakEnergy: energies.length ? Math.max(...energies) : null,
    source: "AUDIO_TIMELINE",
  };
}

export function energyAtMs(profile: VisualEnergyProfile, timeMs: number): number {
  if (!profile.samples.length) return profile.meanEnergy ?? 0.45;
  const hit = profile.samples.find((s) => timeMs >= s.startMs && timeMs < s.endMs);
  if (hit) return hit.energy;
  // nearest
  let best = profile.samples[0]!;
  let bestDist = Math.abs(timeMs - (best.startMs + best.endMs) / 2);
  for (const s of profile.samples) {
    const mid = (s.startMs + s.endMs) / 2;
    const d = Math.abs(timeMs - mid);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best.energy;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function average(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
