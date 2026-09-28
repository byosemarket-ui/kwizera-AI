/**
 * Phase 18C — structured video observations measured from decoded gray frames (no model, no guessing):
 * global camera motion (block matching for pan/tilt, scale search for push-in/pull-out, jitter for handheld),
 * transition type and duration from dense sampling around each boundary (cut, fade through black/white,
 * dissolve, wipe), composition regions around the separable subject, text-like regions (presence and location
 * only — text is never read without an OCR/vision capability), per-scene audio and cut/beat synchronisation,
 * and storytelling roles with the basis for each. Everything not measurable is recorded as UNAVAILABLE.
 */
import type { AudioMeasurement } from "./training-types.js";
import type { SceneMeasurement, SubjectExtent, VisionFrameFacts } from "./teaching-deep-media.js";

const round = (n: number, d = 3) => Number(n.toFixed(d));

export type CameraMovement = "STATIC" | "PAN_LEFT" | "PAN_RIGHT" | "TILT_UP" | "TILT_DOWN" | "PUSH_IN" | "PULL_OUT" | "TRACKING" | "HANDHELD" | "UNCLASSIFIED";
export type TransitionKind = "START" | "CUT" | "FADE_THROUGH_BLACK" | "FADE_THROUGH_WHITE" | "DISSOLVE" | "WIPE" | "GRADUAL_UNCLASSIFIED";
export type StoryRole = "HOOK" | "REVEAL" | "CLOSE_UP" | "SHOWCASE" | "CTA" | "BRIDGE";
export type CapabilityUse = "MEASURED" | "AI_ASSISTED" | "UNAVAILABLE";

export interface Region { x0: number; y0: number; x1: number; y1: number; label: string }

export interface GlobalMotion { dx: number; dy: number; scale: number; gain: number }

export interface TransitionObservation {
  type: TransitionKind;
  /** Seconds of visibly mixed frames; 0 for a cut (shorter than one dense-sample interval). */
  durationSec: number;
  confidence: number;
  method: string;
  evidence: string;
  direction?: "LEFT_TO_RIGHT" | "RIGHT_TO_LEFT" | "TOP_TO_BOTTOM" | "BOTTOM_TO_TOP";
}

export interface TextPresence {
  presence: "DETECTED" | "NOT_DETECTED" | "UNAVAILABLE";
  method: string;
  regions: Region[];
  /** Seconds (absolute) at which a text-like region was seen in the scene samples. */
  seenAtSec: number[];
  readable: false;
}

export interface VideoLearningObservation {
  sourceId: string;
  sceneId: string;
  shotId: string;
  sceneIndex: number;
  timestamps: { startSec: number; endSec: number; durationSec: number };
  visual: { meanLuma: number; contrast: number; motionEnergy: number; motionClass: SceneMeasurement["motionClass"] };
  product: {
    detected: boolean;
    method: string;
    boundingRegion: Region | null;
    center: { x: number; y: number } | null;
    scale: number | null;
    prominence: "HERO" | "PROMINENT" | "SECONDARY" | null;
    cropRisk: "HIGH" | "MEDIUM" | "LOW" | null;
    location: string | null;
  };
  composition: { negativeSpace: number | null; textSafeRegions: Region[]; productSafeRegion: Region | null };
  camera: { movement: CameraMovement; confidence: number; panPerSec: number; tiltPerSec: number; zoomPerSec: number; evidence: string };
  motion: { energy: number; class: SceneMeasurement["motionClass"] };
  transition: TransitionObservation | null;
  text: TextPresence;
  typography: { status: "UNAVAILABLE" | "AI_ASSISTED"; items: VisionFrameFacts["textItems"]; note: string };
  audio: {
    present: boolean;
    energy: number | null;
    beats: number;
    silenceSec: number;
    speech: "UNAVAILABLE";
    music: "RHYTHMIC_MUSIC_MEASURED" | "AUDIO_PRESENT_UNCLASSIFIED" | "SILENT" | "NO_AUDIO";
  };
  synchronization: { cutOffsetMs: number | null; onBeat: boolean | null; onDownbeat: boolean | null; energyChange: "RISE" | "FALL" | "STEADY" | null; evidence: string } | null;
  storytelling: { role: StoryRole; basis: "POSITION" | "MEASURED" | "VISION"; confidence: number; note: string };
  confidence: number;
  evidence: string[];
  capabilityAvailability: Record<string, CapabilityUse>;
}

// ---------- camera motion ----------

function sad(cur: Uint8Array | Buffer, prev: Uint8Array | Buffer, w: number, h: number, dx: number, dy: number, scale: number, margin: number): number {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  let sum = 0;
  let n = 0;
  for (let y = margin; y < h - margin; y += 1) {
    for (let x = margin; x < w - margin; x += 1) {
      const sx = Math.round(cx + (x - cx) / scale - dx);
      const sy = Math.round(cy + (y - cy) / scale - dy);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      sum += Math.abs(cur[y * w + x]! - prev[sy * w + sx]!);
      n += 1;
    }
  }
  return n ? sum / n : Infinity;
}

const SCALES = [0.9, 0.94, 0.97, 1, 1.03, 1.06, 1.1];

/**
 * Global motion between two gray frames: content displacement (dx, dy in pixels; cur(x) ≈ prev(x − dx)) and
 * scale (> 1 = content grows). `gain` is how much better the model explains the frame than no motion (0–1).
 */
export function globalMotion(prev: Uint8Array | Buffer, cur: Uint8Array | Buffer, w: number, h: number, range = 5): GlobalMotion {
  const margin = Math.min(range + 1, Math.floor(Math.min(w, h) / 6));
  const still = sad(cur, prev, w, h, 0, 0, 1, margin);
  let best = { dx: 0, dy: 0, err: still };
  for (let dy = -range; dy <= range; dy += 1) {
    for (let dx = -range; dx <= range; dx += 1) {
      if (!dx && !dy) continue;
      const err = sad(cur, prev, w, h, dx, dy, 1, margin);
      if (err < best.err) best = { dx, dy, err };
    }
  }
  let scale = 1;
  let err = best.err;
  for (const s of SCALES) {
    if (s === 1) continue;
    const e = sad(cur, prev, w, h, best.dx, best.dy, s, margin);
    if (e < err) { err = e; scale = s; }
  }
  const gain = still > 0.5 ? Math.max(0, (still - err) / still) : 0;
  return { dx: best.dx, dy: best.dy, scale, gain: round(gain) };
}

/**
 * Classifies the camera for a scene from per-pair global motion (sampled at `fps`). `longPairs` (frames ~1 s apart)
 * resolve slow zooms whose per-pair scale change is below the scale-search step.
 */
export function classifyCamera(pairs: GlobalMotion[], fps: number, w: number, h: number, subjectCentersX: number[] = [], longPairs: Array<{ motion: GlobalMotion; spanSec: number }> = []): Omit<VideoLearningObservation["camera"], "evidence"> & { evidence: string } {
  const valid = pairs.filter((p) => p.gain >= 0.08 || (p.dx === 0 && p.dy === 0 && p.scale === 1));
  if (!pairs.length) return { movement: "UNCLASSIFIED", confidence: 0, panPerSec: 0, tiltPerSec: 0, zoomPerSec: 0, evidence: "Scene too short for motion pairs." };
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const dxs = valid.map((p) => p.dx);
  const dys = valid.map((p) => p.dy);
  const panPerSec = round((mean(dxs) * fps) / w);
  const tiltPerSec = round((mean(dys) * fps) / h);
  const shortZoom = mean(valid.map((p) => Math.log(p.scale))) * fps;
  const longValid = longPairs.filter((l) => l.spanSec > 0 && l.motion.gain >= 0.15);
  const longZoom = longValid.length >= Math.max(1, Math.ceil(longPairs.length / 2)) ? mean(longValid.map((l) => Math.log(l.motion.scale) / l.spanSec)) : 0;
  const zoomPerSec = round(Math.abs(longZoom) > Math.abs(shortZoom) ? longZoom : shortZoom);
  const moving = valid.filter((p) => p.dx || p.dy);
  const signFlips = moving.slice(1).filter((p, i) => Math.sign(p.dx) !== Math.sign(moving[i]!.dx) || Math.sign(p.dy) !== Math.sign(moving[i]!.dy)).length;
  const coverage = valid.length / pairs.length;
  const evidence = `${pairs.length} frame pairs at ${fps} fps${longPairs.length ? ` and ${longPairs.length} one-second pairs` : ""}: pan ${panPerSec} width/s, tilt ${tiltPerSec} height/s, zoom ${zoomPerSec} log-scale/s (${Math.round(coverage * 100)}% explained by global motion)`;
  const conf = (x: number) => round(Math.max(0.3, Math.min(0.9, x * coverage)), 2);
  if (coverage < 0.5) return { movement: "UNCLASSIFIED", confidence: 0.3, panPerSec, tiltPerSec, zoomPerSec, evidence: `${evidence}; motion is local (subject or content), not a camera move.` };
  if (Math.abs(zoomPerSec) >= 0.03 && Math.abs(zoomPerSec) * 1.5 >= Math.max(Math.abs(panPerSec), Math.abs(tiltPerSec))) {
    return { movement: zoomPerSec > 0 ? "PUSH_IN" : "PULL_OUT", confidence: conf(0.55 + Math.min(0.35, Math.abs(zoomPerSec) * 3)), panPerSec, tiltPerSec, zoomPerSec, evidence };
  }
  if (moving.length >= 3 && signFlips / Math.max(1, moving.length - 1) >= 0.4 && Math.abs(panPerSec) < 0.03 && Math.abs(tiltPerSec) < 0.03) {
    return { movement: "HANDHELD", confidence: conf(0.6), panPerSec, tiltPerSec, zoomPerSec, evidence: `${evidence}; direction changes in ${signFlips} of ${moving.length - 1} moving pairs.` };
  }
  if (Math.abs(panPerSec) >= 0.03 && Math.abs(panPerSec) >= Math.abs(tiltPerSec)) {
    const stable = subjectCentersX.length >= 2 && Math.max(...subjectCentersX) - Math.min(...subjectCentersX) <= 0.05;
    if (stable) return { movement: "TRACKING", confidence: conf(0.6), panPerSec, tiltPerSec, zoomPerSec, evidence: `${evidence}; the subject stays at a fixed position while the background moves.` };
    return { movement: panPerSec > 0 ? "PAN_LEFT" : "PAN_RIGHT", confidence: conf(0.55 + Math.min(0.35, Math.abs(panPerSec) * 2)), panPerSec, tiltPerSec, zoomPerSec, evidence };
  }
  if (Math.abs(tiltPerSec) >= 0.03) {
    return { movement: tiltPerSec > 0 ? "TILT_UP" : "TILT_DOWN", confidence: conf(0.55 + Math.min(0.35, Math.abs(tiltPerSec) * 2)), panPerSec, tiltPerSec, zoomPerSec, evidence };
  }
  return { movement: "STATIC", confidence: conf(0.8), panPerSec, tiltPerSec, zoomPerSec, evidence };
}

// ---------- transitions ----------

const meanAbs = (a: Uint8Array | Buffer | Float32Array, b: Uint8Array | Buffer | Float32Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += Math.abs(a[i]! - b[i]!);
  return s / Math.max(1, a.length);
};
const meanOf = (a: Uint8Array | Buffer | Float32Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i]!;
  return s / Math.max(1, a.length);
};

function average(frames: Array<Uint8Array | Buffer>): Float32Array {
  const out = new Float32Array(frames[0]!.length);
  for (const f of frames) for (let i = 0; i < out.length; i += 1) out[i]! += f[i]! / frames.length;
  return out;
}

/** Column (or row) split test for wipes: fraction of lines consistent with a single A|B split, and the split. */
function splitFit(f: Uint8Array | Buffer, a: Float32Array, b: Float32Array, w: number, h: number, vertical: boolean): { fit: number; split: number; bFirst: boolean } {
  const lines = vertical ? h : w;
  const nearB: boolean[] = [];
  for (let l = 0; l < lines; l += 1) {
    let da = 0; let db = 0;
    const len = vertical ? w : h;
    for (let k = 0; k < len; k += 1) {
      const i = vertical ? l * w + k : k * w + l;
      da += Math.abs(f[i]! - a[i]!);
      db += Math.abs(f[i]! - b[i]!);
    }
    nearB.push(db < da);
  }
  let best = { fit: 0, split: 0, bFirst: true };
  for (let s = 0; s <= lines; s += 1) {
    for (const bFirst of [true, false]) {
      let ok = 0;
      for (let l = 0; l < lines; l += 1) if ((l < s) === (bFirst ? nearB[l] : !nearB[l])) ok += 1;
      if (ok / lines > best.fit) best = { fit: ok / lines, split: s / lines, bFirst };
    }
  }
  return best;
}

/**
 * Classifies the transition in a dense window of gray frames straddling a boundary. The first and last two frames
 * represent the outgoing and incoming shots; mixed frames in between decide the type and duration.
 */
export function classifyTransition(frames: Array<Uint8Array | Buffer>, w: number, h: number, fps: number): TransitionObservation {
  const method = `dense sampling at ${fps} fps around the boundary`;
  if (frames.length < 5) return { type: "CUT", durationSec: 0, confidence: 0.4, method, evidence: "Too few dense frames; treated as a cut." };
  const a = average(frames.slice(0, 2));
  const b = average(frames.slice(-2));
  const dAB = meanAbs(a, b);
  if (dAB < 4) return { type: "GRADUAL_UNCLASSIFIED", durationSec: 0, confidence: 0.3, method, evidence: "Outgoing and incoming frames are nearly identical." };
  const mid = frames.slice(2, -2);
  const info = mid.map((f) => {
    const da = meanAbs(f, a);
    const db = meanAbs(f, b);
    let num = 0; let den = 0;
    for (let i = 0; i < f.length; i += 1) { const d = b[i]! - a[i]!; num += (f[i]! - a[i]!) * d; den += d * d; }
    const alpha = den ? Math.max(0, Math.min(1, num / den)) : 0;
    let res = 0;
    for (let i = 0; i < f.length; i += 1) res += Math.abs(f[i]! - (a[i]! * (1 - alpha) + b[i]! * alpha));
    return { da, db, alpha, residual: res / f.length, luma: meanOf(f) };
  });
  const mixedIdx = info.map((x, i) => (Math.min(x.da, x.db) > 0.3 * dAB ? i : -1)).filter((i) => i >= 0);
  const lumaA = meanOf(a);
  const lumaB = meanOf(b);
  if (!mixedIdx.length) {
    return { type: "CUT", durationSec: 0, confidence: 0.85, method, evidence: `Frames switch from the outgoing to the incoming shot between two samples (${round(1 / fps, 3)} s apart); no mixed frames.` };
  }
  const mixed = mixedIdx.map((i) => info[i]!);
  const durationSec = round((mixedIdx[mixedIdx.length - 1]! - mixedIdx[0]! + 1) / fps, 2);
  const minLuma = Math.min(...mixed.map((x) => x.luma));
  const maxLuma = Math.max(...mixed.map((x) => x.luma));
  if (minLuma < 24 && minLuma < 0.5 * Math.min(lumaA, lumaB)) {
    return { type: "FADE_THROUGH_BLACK", durationSec, confidence: 0.85, method, evidence: `Mean luma dips to ${round(minLuma, 1)} (shots ${round(lumaA, 1)} → ${round(lumaB, 1)}) across ${mixed.length} frames.` };
  }
  if (maxLuma > 232 && maxLuma > Math.max(lumaA, lumaB) + 25) {
    return { type: "FADE_THROUGH_WHITE", durationSec, confidence: 0.8, method, evidence: `Mean luma rises to ${round(maxLuma, 1)} across ${mixed.length} frames.` };
  }
  const alphas = mixed.map((x) => x.alpha);
  const monotonic = alphas.slice(1).every((v, i) => v >= alphas[i]! - 0.08);
  const blendFit = mixed.reduce((s, x) => s + x.residual, 0) / mixed.length;
  if (monotonic && blendFit < 0.3 * dAB) {
    return { type: "DISSOLVE", durationSec, confidence: round(Math.min(0.9, 0.6 + (0.3 - blendFit / dAB)), 2), method,
      evidence: `${mixed.length} frames are blends of both shots (mix ${alphas.map((x) => round(x, 2)).join(" → ")}, residual ${round(blendFit, 1)} vs shot difference ${round(dAB, 1)}).` };
  }
  for (const vertical of [false, true]) {
    const fits = mixedIdx.map((i) => splitFit(frames[i + 2]!, a, b, w, h, vertical));
    const good = fits.every((f) => f.fit >= 0.85) && fits.every((f) => f.bFirst === fits[0]!.bFirst);
    const splits = fits.map((f) => f.split);
    const moves = splits.length >= 1 && (splits.length === 1 || splits.slice(1).every((s, i) => (fits[0]!.bFirst ? s >= splits[i]! : s <= splits[i]!)));
    if (good && moves) {
      const bFirst = fits[0]!.bFirst;
      const direction = vertical ? (bFirst ? "TOP_TO_BOTTOM" : "BOTTOM_TO_TOP") : (bFirst ? "LEFT_TO_RIGHT" : "RIGHT_TO_LEFT");
      return { type: "WIPE", durationSec, confidence: 0.75, method, direction, evidence: `${mixed.length} frames split cleanly between the two shots along ${vertical ? "rows" : "columns"} (split ${splits.map((s) => round(s, 2)).join(" → ")}).` };
    }
  }
  return { type: "GRADUAL_UNCLASSIFIED", durationSec, confidence: 0.45, method, evidence: `${mixed.length} mixed frames that are neither a blend, a fade nor a clean wipe (slides and zoom transitions are not classified).` };
}

/**
 * Coarse-pass candidates for gradual transitions the cut detector misses: a large change over ~1 s that global
 * camera motion does not explain, away from known boundaries.
 */
export function gradualTransitionCandidates(frames: Array<Uint8Array | Buffer>, w: number, h: number, fps: number, known: number[], duration: number): number[] {
  const span = Math.max(1, Math.round(fps * 0.5));
  const out: number[] = [];
  for (let i = span; i + span < frames.length; i += 1) {
    const t = i / fps;
    if (t < 0.5 || t > duration - 0.5) continue;
    if ([...known, ...out].some((k) => Math.abs(k - t) < 1)) continue;
    const change = meanAbs(frames[i - span]!, frames[i + span]!);
    if (change < 18) continue;
    const gm = globalMotion(frames[i - span]!, frames[i + span]!, w, h, 4);
    if (gm.gain >= 0.5) continue;
    let peak = i;
    for (let j = i; j < Math.min(frames.length - span, i + span * 2); j += 1) {
      if (meanAbs(frames[j - span]!, frames[j + span]!) > meanAbs(frames[peak - span]!, frames[peak + span]!)) peak = j;
    }
    out.push(round(peak / fps, 2));
  }
  return out;
}

// ---------- composition and text-like regions ----------

const bandLabel = (cx: number, cy: number) => `${cy < 0.34 ? "top" : cy > 0.66 ? "bottom" : "middle"}-${cx < 0.34 ? "left" : cx > 0.66 ? "right" : "center"}`;

export function compositionFromSubject(s: SubjectExtent | null): Pick<VideoLearningObservation, "product" | "composition"> {
  const method = "Separable subject against the border-estimated background (measured; not identified as a specific product)";
  if (!s || !s.separable || s.coverage >= 0.9) {
    return {
      product: { detected: false, method, boundingRegion: null, center: null, scale: null, prominence: null, cropRisk: null, location: null },
      composition: { negativeSpace: null, textSafeRegions: [], productSafeRegion: null },
    };
  }
  const box: Region = { x0: round(s.box.left), y0: round(s.box.top), x1: round(s.box.right), y1: round(s.box.bottom), label: "subject" };
  const minMargin = Math.min(s.margins.left, s.margins.right, s.margins.top, s.margins.bottom);
  const safe: Region = { x0: round(Math.max(0, box.x0 - 0.05)), y0: round(Math.max(0, box.y0 - 0.05)), x1: round(Math.min(1, box.x1 + 0.05)), y1: round(Math.min(1, box.y1 + 0.05)), label: "product-safe" };
  const textSafe: Region[] = [];
  if (safe.y0 >= 0.15) textSafe.push({ x0: 0.05, y0: 0.03, x1: 0.95, y1: round(safe.y0 - 0.01), label: "top band" });
  if (1 - safe.y1 >= 0.15) textSafe.push({ x0: 0.05, y0: round(safe.y1 + 0.01), x1: 0.95, y1: 0.97, label: "bottom band" });
  if (safe.x0 >= 0.25) textSafe.push({ x0: 0.03, y0: 0.1, x1: round(safe.x0 - 0.01), y1: 0.9, label: "left column" });
  if (1 - safe.x1 >= 0.25) textSafe.push({ x0: round(safe.x1 + 0.01), y0: 0.1, x1: 0.97, y1: 0.9, label: "right column" });
  return {
    product: {
      detected: true, method, boundingRegion: box, center: { x: round(s.centerX), y: round(s.centerY) }, scale: round(s.coverage),
      prominence: s.coverage >= 0.35 ? "HERO" : s.coverage >= 0.15 ? "PROMINENT" : "SECONDARY",
      cropRisk: s.touchesEdge ? "HIGH" : minMargin < 0.04 ? "MEDIUM" : "LOW",
      location: bandLabel(s.centerX, s.centerY),
    },
    composition: { negativeSpace: round(1 - (box.x1 - box.x0) * (box.y1 - box.y0)), textSafeRegions: textSafe, productSafeRegion: safe },
  };
}

/**
 * Text-like regions: horizontal bands with dense, evenly spread sharp luminance transitions (typical of rendered
 * glyphs) on a gray keyframe of width ≥ 160 px. Reports presence and location only — the text is never read.
 */
export function textLikeRegions(px: Uint8Array | Buffer, w: number, h: number, exclude: Region | null = null): Region[] {
  const rowScore: number[] = [];
  const rowSpread: Array<[number, number]> = [];
  for (let y = 0; y < h; y += 1) {
    let edges = 0; let first = -1; let last = -1;
    for (let x = 0; x + 1 < w; x += 1) {
      const nx = x / w;
      const ny = y / h;
      if (exclude && nx >= exclude.x0 && nx <= exclude.x1 && ny >= exclude.y0 && ny <= exclude.y1) continue;
      if (Math.abs(px[y * w + x + 1]! - px[y * w + x]!) >= 60) { edges += 1; if (first < 0) first = x; last = x; }
    }
    rowScore.push(edges / w);
    rowSpread.push([first, last]);
  }
  const regions: Region[] = [];
  let start = -1;
  const flush = (end: number) => {
    const rows = end - start;
    if (rows >= Math.max(3, h * 0.012) && rows <= h * 0.25) {
      const spans = rowSpread.slice(start, end).filter(([f]) => f >= 0);
      const x0 = Math.min(...spans.map(([f]) => f)) / w;
      const x1 = Math.max(...spans.map(([, l]) => l)) / w;
      const avg = rowScore.slice(start, end).reduce((a, b) => a + b, 0) / rows;
      if (x1 - x0 >= 0.12 && avg >= 0.06) {
        const cy = (start + end) / 2 / h;
        regions.push({ x0: round(x0), y0: round(start / h), x1: round(x1), y1: round(end / h), label: `${cy < 0.34 ? "top" : cy > 0.66 ? "bottom" : "middle"} text-like band` });
      }
    }
    start = -1;
  };
  for (let y = 0; y < h; y += 1) {
    const on = rowScore[y]! >= 0.05;
    if (on && start < 0) start = y;
    if (!on && start >= 0) flush(y);
  }
  if (start >= 0) flush(h);
  return regions.slice(0, 6);
}

// ---------- story roles ----------

export function storyRoles(scenes: Array<Pick<SceneMeasurement, "index" | "durationSec" | "subjectCoverage" | "transitionIn" | "vision"> & { camera: CameraMovement; textDetected: boolean }>): VideoLearningObservation["storytelling"][] {
  const out: VideoLearningObservation["storytelling"][] = [];
  let revealed = false;
  for (let i = 0; i < scenes.length; i += 1) {
    const s = scenes[i]!;
    const prev = scenes[i - 1];
    if (i === 0) {
      out.push({ role: "HOOK", basis: "POSITION", confidence: 0.7, note: `Opening scene (${s.durationSec.toFixed(1)} s)${s.durationSec <= 3 ? ", short opening" : ""}.` });
      continue;
    }
    if (i === scenes.length - 1 && scenes.length > 1) {
      if (s.vision?.hasCallToAction) out.push({ role: "CTA", basis: "VISION", confidence: 0.75, note: "Vision layout analysis saw a call to action." });
      else out.push({ role: "CTA", basis: s.textDetected ? "MEASURED" : "POSITION", confidence: s.textDetected ? 0.55 : 0.4, note: s.textDetected ? "Closing scene with a text-like region (text not read)." : "Closing position; call-to-action content is not verifiable without text reading." });
      continue;
    }
    const grows = prev && s.subjectCoverage !== null && prev.subjectCoverage !== null && s.subjectCoverage >= prev.subjectCoverage * 1.3;
    const firstSubject = prev && s.subjectCoverage !== null && prev.subjectCoverage === null;
    if (!revealed && (grows || firstSubject || s.camera === "PUSH_IN" || s.transitionIn === "FADE_THROUGH_BLACK")) {
      revealed = true;
      out.push({ role: "REVEAL", basis: "MEASURED", confidence: 0.6, note: grows ? "Subject grows markedly versus the previous scene." : firstSubject ? "Subject first appears." : s.camera === "PUSH_IN" ? "Camera pushes in on the subject." : "Scene opens from black." });
      continue;
    }
    if (out[i - 1]?.role === "REVEAL" && prev && s.subjectCoverage !== null && s.subjectCoverage >= 0.45 && prev.subjectCoverage !== null && s.subjectCoverage >= prev.subjectCoverage * 1.2) {
      out.push({ role: "CLOSE_UP", basis: "MEASURED", confidence: 0.6, note: `Subject fills ${Math.round(s.subjectCoverage * 100)}% of the frame right after the reveal (${Math.round(prev.subjectCoverage * 100)}% before), ${s.durationSec.toFixed(1)} s.` });
      continue;
    }
    if (s.subjectCoverage !== null && s.camera !== "STATIC") out.push({ role: "SHOWCASE", basis: "MEASURED", confidence: 0.55, note: `Subject on screen with ${s.camera.toLowerCase().replace("_", " ")} camera.` });
    else out.push({ role: "BRIDGE", basis: "POSITION", confidence: 0.4, note: "Middle scene without a measured reveal or showcase signal." });
  }
  return out;
}

// ---------- per-scene assembly ----------

export interface SceneExtras {
  camera: ReturnType<typeof classifyCamera>;
  transition: TransitionObservation | null;
  keySubject: SubjectExtent | null;
  text: TextPresence;
}

export function buildObservations(input: {
  sourceId: string;
  scenes: SceneMeasurement[];
  extras: SceneExtras[];
  audio: AudioMeasurement | null;
  visionUsed: boolean;
}): VideoLearningObservation[] {
  const { scenes, extras, audio } = input;
  const roles = storyRoles(scenes.map((s, i) => ({ ...s, camera: extras[i]?.camera.movement ?? "UNCLASSIFIED", textDetected: extras[i]?.text.presence === "DETECTED" })));
  const period = audio?.bpm ? 60 / audio.bpm : null;
  const tol = period ? Math.min(0.08, period * 0.15) : 0;
  return scenes.map((s, i) => {
    const x = extras[i]!;
    const comp = compositionFromSubject(x.keySubject);
    const beats = (audio?.beatTimes ?? []).filter((b) => b >= s.start && b < s.end).length;
    const silenceSec = round((audio?.silences ?? []).reduce((a, z) => a + Math.max(0, Math.min(z.end, s.end) - Math.max(z.start, s.start)), 0), 2);
    const nearest = audio?.beatTimes?.length ? audio.beatTimes.reduce((best, b) => (Math.abs(b - s.start) < Math.abs(best - s.start) ? b : best), audio.beatTimes[0]!) : null;
    const prevEnergy = i ? scenes[i - 1]!.energy : null;
    const sync = i === 0 || !audio ? null : {
      cutOffsetMs: nearest === null ? null : Math.round((s.start - nearest) * 1000),
      onBeat: period && audio.beatTimes?.length ? audio.beatTimes.some((b) => Math.abs(b - s.start) <= tol) : null,
      onDownbeat: period && audio.downbeatTimes?.length ? audio.downbeatTimes.some((b) => Math.abs(b - s.start) <= tol) : null,
      energyChange: prevEnergy === null || s.energy === null ? null : s.energy > prevEnergy + 0.1 ? "RISE" as const : s.energy < prevEnergy - 0.1 ? "FALL" as const : "STEADY" as const,
      evidence: nearest === null ? "No beat grid measured." : `Boundary at ${s.start.toFixed(2)} s; nearest beat ${nearest.toFixed(2)} s (±${Math.round(tol * 1000)} ms tolerance).`,
    };
    const typography: VideoLearningObservation["typography"] = s.vision?.textItems.length
      ? { status: "AI_ASSISTED", items: s.vision.textItems, note: "Roles, positions and relative sizes from Admin-routed vision; font names are never identified." }
      : { status: "UNAVAILABLE", items: [], note: input.visionUsed ? "Vision saw no text items in this keyframe." : "Typography needs an executable VISION_ANALYSIS capability; font names are never guessed." };
    const evidence = [
      `motion energy ${s.motion} (${s.motionClass.toLowerCase()})`,
      x.camera.evidence,
      ...(x.transition ? [`transition in: ${x.transition.type.toLowerCase().replace(/_/g, " ")} — ${x.transition.evidence}`] : []),
      ...(comp.product.detected ? [`subject box ${JSON.stringify(comp.product.boundingRegion)}`] : []),
      ...(x.text.presence === "DETECTED" ? [`text-like region(s): ${x.text.regions.map((r) => r.label).join(", ")}`] : []),
    ];
    const availability: Record<string, CapabilityUse> = {
      scenes: "MEASURED", camera: "MEASURED", motion: "MEASURED", transition: x.transition ? "MEASURED" : i === 0 ? "MEASURED" : "UNAVAILABLE",
      product: "MEASURED", composition: "MEASURED", textPresence: x.text.presence === "UNAVAILABLE" ? "UNAVAILABLE" : "MEASURED", textContent: s.vision ? "AI_ASSISTED" : "UNAVAILABLE",
      typography: typography.status === "AI_ASSISTED" ? "AI_ASSISTED" : "UNAVAILABLE", fontIdentification: "UNAVAILABLE",
      audio: audio ? "MEASURED" : "UNAVAILABLE", speech: "UNAVAILABLE", synchronization: audio?.beatTimes?.length ? "MEASURED" : "UNAVAILABLE",
      storytelling: roles[i]!.basis === "VISION" ? "AI_ASSISTED" : "MEASURED",
    };
    return {
      sourceId: input.sourceId, sceneId: `scene-${s.index}`, shotId: `shot-${s.index}`, sceneIndex: s.index,
      timestamps: { startSec: s.start, endSec: s.end, durationSec: s.durationSec },
      visual: { meanLuma: s.meanLuma, contrast: s.contrast, motionEnergy: s.motion, motionClass: s.motionClass },
      ...comp,
      camera: x.camera,
      motion: { energy: s.motion, class: s.motionClass },
      transition: i === 0 ? { type: "START", durationSec: 0, confidence: 1, method: "position", evidence: "First scene." } : x.transition,
      text: x.text,
      typography,
      audio: {
        present: Boolean(audio), energy: s.energy, beats, silenceSec, speech: "UNAVAILABLE",
        music: !audio ? "NO_AUDIO" : audio.silent ? "SILENT" : audio.bpm && audio.tempoStatus === "available" ? "RHYTHMIC_MUSIC_MEASURED" : "AUDIO_PRESENT_UNCLASSIFIED",
      },
      synchronization: sync,
      storytelling: roles[i]!,
      confidence: round(Math.min(0.9, (x.camera.confidence + (x.transition?.confidence ?? 0.7) + roles[i]!.confidence) / 3), 2),
      evidence,
      capabilityAvailability: availability,
    };
  });
}
