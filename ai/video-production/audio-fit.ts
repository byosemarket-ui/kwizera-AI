/**
 * Phase 16 — reconcile selected music duration with the final video duration.
 * Pure planning + FFmpeg filter text; muxing stays in ffmpeg-renderer.
 * Beat/downbeat boundaries are used only when Audio Intelligence actually produced them.
 */

export const AUDIO_FIT_VERSION = "audio-fit-v1";

export type AudioFitStrategy =
  /** Source already matches the video length (within tolerance). */
  | "EXACT"
  /** Source is shorter: repeat a loop segment with crossfades until the video ends. */
  | "LOOP_EXTEND"
  /** Source is longer: end with a fade that finishes exactly with the video. */
  | "TRIM_FADE"
  /** Source is too short to loop musically, or looping is not allowed (voice): play once, then silence. */
  | "PAD_SILENCE";

export type AudioBoundaryBasis = "downbeat" | "beat" | "tempo" | "duration";

export interface AudioFitAnalysis {
  bpm?: number | null;
  beats?: Array<{ time: number }>;
  downbeats?: Array<{ time: number }>;
}

export interface AudioFitPlan {
  version: typeof AUDIO_FIT_VERSION;
  strategy: AudioFitStrategy;
  sourceDurationSec: number;
  targetDurationSec: number;
  /** Seconds of real (non-silent) audio the fitted track covers. */
  coveredDurationSec: number;
  loopEndSec: number | null;
  repeats: number;
  crossfadeSec: number;
  fadeOutStartSec: number;
  fadeOutSec: number;
  boundaryBasis: AudioBoundaryBasis;
  /** True only when beat/downbeat/tempo analysis determined a boundary. */
  beatAnalysisUsed: boolean;
  reason: string;
}

const EXACT_TOLERANCE_SEC = 0.25;
/** Below this a loop would repeat so often it stops sounding like music. */
export const MIN_LOOPABLE_SEC = 4;
const MAX_REPEATS = 48;

function round(n: number): number {
  return Number(n.toFixed(3));
}

function times(list?: Array<{ time: number }>): number[] {
  return (list ?? []).map((e) => e.time).filter((t) => Number.isFinite(t) && t >= 0).sort((a, b) => a - b);
}

/** Latest musical boundary inside [min, max]; null when analysis has none there. */
function loopBoundary(source: number, analysis: AudioFitAnalysis | null | undefined): { end: number; basis: AudioBoundaryBasis } {
  const min = source * 0.5;
  const max = source - 0.05;
  const downbeats = times(analysis?.downbeats).filter((t) => t >= min && t <= max);
  if (downbeats.length) return { end: downbeats[downbeats.length - 1]!, basis: "downbeat" };
  const bpm = analysis?.bpm ?? null;
  if (bpm && bpm >= 40 && bpm <= 240) {
    const bar = 240 / bpm;
    const bars = Math.floor(max / bar);
    const end = bars * bar;
    if (end >= min) return { end, basis: "tempo" };
  }
  const beats = times(analysis?.beats).filter((t) => t >= min && t <= max);
  if (beats.length) return { end: beats[beats.length - 1]!, basis: "beat" };
  return { end: source, basis: "duration" };
}

/** Beat nearest to `target` within ±window, or null. */
function nearestBeat(target: number, analysis: AudioFitAnalysis | null | undefined, window: number): { time: number; basis: AudioBoundaryBasis } | null {
  const pick = (list: number[], basis: AudioBoundaryBasis) => {
    let best: number | null = null;
    for (const t of list) {
      if (Math.abs(t - target) <= window && (best === null || Math.abs(t - target) < Math.abs(best - target))) best = t;
    }
    return best === null ? null : { time: best, basis };
  };
  return pick(times(analysis?.downbeats), "downbeat") ?? pick(times(analysis?.beats), "beat");
}

export function planAudioFit(input: {
  sourceDurationSec: number;
  targetDurationSec: number;
  analysis?: AudioFitAnalysis | null;
  /** Voice/narration must never repeat. */
  allowLoop?: boolean;
}): AudioFitPlan {
  const source = Math.max(0, input.sourceDurationSec);
  const target = Math.max(0.2, input.targetDurationSec);
  const allowLoop = input.allowLoop !== false;
  const base = {
    version: AUDIO_FIT_VERSION,
    sourceDurationSec: round(source),
    targetDurationSec: round(target),
    loopEndSec: null,
    repeats: 1,
    crossfadeSec: 0,
  } as const;

  if (!source || Math.abs(source - target) <= EXACT_TOLERANCE_SEC) {
    const fadeOutSec = round(Math.min(0.5, target / 4));
    return {
      ...base,
      strategy: "EXACT",
      coveredDurationSec: round(Math.min(source || target, target)),
      fadeOutStartSec: round(target - fadeOutSec),
      fadeOutSec,
      boundaryBasis: "duration",
      beatAnalysisUsed: false,
      reason: source ? "Audio length already matches the video." : "Audio length unknown; fitted to the video length.",
    };
  }

  if (source > target) {
    let fadeOutSec = Math.max(1, Math.min(3, target * 0.08));
    let basis: AudioBoundaryBasis = "duration";
    const beat = nearestBeat(target - fadeOutSec, input.analysis, 0.75);
    if (beat && beat.time > 0 && beat.time < target - 0.4) {
      fadeOutSec = target - beat.time;
      basis = beat.basis;
    }
    return {
      ...base,
      strategy: "TRIM_FADE",
      coveredDurationSec: round(target),
      fadeOutStartSec: round(target - fadeOutSec),
      fadeOutSec: round(fadeOutSec),
      boundaryBasis: basis,
      beatAnalysisUsed: basis !== "duration",
      reason: basis === "duration"
        ? "Audio is longer than the video; it fades out and ends with the video."
        : `Audio is longer than the video; the fade-out starts on a ${basis} and ends with the video.`,
    };
  }

  if (!allowLoop || source < MIN_LOOPABLE_SEC) {
    const fadeOutSec = round(Math.min(0.5, source / 4));
    return {
      ...base,
      strategy: "PAD_SILENCE",
      coveredDurationSec: round(source),
      fadeOutStartSec: round(Math.max(0, source - fadeOutSec)),
      fadeOutSec,
      boundaryBasis: "duration",
      beatAnalysisUsed: false,
      reason: !allowLoop
        ? "Voice audio is never repeated; it plays once."
        : `Audio is shorter than ${MIN_LOOPABLE_SEC}s and cannot be looped naturally; it plays once.`,
    };
  }

  const { end, basis } = loopBoundary(source, input.analysis);
  const musical = basis !== "duration";
  // Musical boundaries get a short crossfade that keeps the beat; arbitrary ones need a longer blend.
  const crossfadeSec = musical ? Math.min(0.08, end / 8) : Math.min(1, end / 4);
  const repeats = Math.min(MAX_REPEATS, Math.max(2, Math.ceil((target - crossfadeSec) / Math.max(0.1, end - crossfadeSec))));
  const covered = Math.min(target, repeats * end - (repeats - 1) * crossfadeSec);
  const fadeOutSec = Math.max(1, Math.min(2, target * 0.06));
  return {
    ...base,
    strategy: "LOOP_EXTEND",
    loopEndSec: round(end),
    repeats,
    crossfadeSec: round(crossfadeSec),
    coveredDurationSec: round(covered),
    fadeOutStartSec: round(target - fadeOutSec),
    fadeOutSec: round(fadeOutSec),
    boundaryBasis: basis,
    beatAnalysisUsed: musical,
    reason: musical
      ? `Audio is shorter than the video; it loops on a ${basis} boundary with a short crossfade.`
      : "Audio is shorter than the video; it loops with a crossfade (no beat analysis available).",
  };
}

/**
 * FFmpeg filtergraph that turns `inputLabel` into a track of exactly the target length at `outputLabel`.
 * `labelPrefix` keeps intermediate labels unique when several tracks share one graph.
 */
export function buildAudioFitFilter(
  plan: AudioFitPlan,
  inputLabel: string,
  outputLabel: string,
  options?: { volume?: number; labelPrefix?: string },
): string {
  const t = plan.targetDurationSec.toFixed(3);
  const volume = Math.min(1, Math.max(0, options?.volume ?? 1));
  const vol = volume === 1 ? "" : `volume=${volume.toFixed(3)},`;
  const p = options?.labelPrefix ?? "fit";
  const fade = plan.fadeOutSec > 0
    ? `afade=t=out:st=${plan.fadeOutStartSec.toFixed(3)}:d=${plan.fadeOutSec.toFixed(3)},`
    : "";

  if (plan.strategy === "LOOP_EXTEND" && plan.loopEndSec && plan.repeats >= 2) {
    const n = plan.repeats;
    const segs = Array.from({ length: n }, (_, i) => `[${p}s${i}]`);
    const parts = [
      `${inputLabel}${vol}atrim=0:${plan.loopEndSec.toFixed(3)},asetpts=PTS-STARTPTS,asplit=${n}${segs.join("")}`,
    ];
    let prev = segs[0]!;
    for (let i = 1; i < n; i += 1) {
      const out = `[${p}x${i}]`;
      parts.push(`${prev}${segs[i]}acrossfade=d=${plan.crossfadeSec.toFixed(3)}:c1=tri:c2=tri${out}`);
      prev = out;
    }
    parts.push(`${prev}atrim=0:${t},asetpts=PTS-STARTPTS,${fade}apad=whole_dur=${t}${outputLabel}`);
    return parts.join(";");
  }

  return `${inputLabel}${vol}atrim=0:${t},asetpts=PTS-STARTPTS,${fade}apad=whole_dur=${t}${outputLabel}`;
}
