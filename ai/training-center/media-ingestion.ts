/**
 * Phase 20 — canonical media ingestion for teaching sources:
 * RECEIVE → SECURITY VALIDATION → TYPE DETECTION (content, not extension) → METADATA PROBE → STREAM DETECTION →
 * NORMALIZATION PLAN → NORMALIZATION IF REQUIRED → CANONICAL MEDIA ASSET → ANALYSIS.
 * The original upload is never modified; a normalised analysis derivative is written to a temporary file and its
 * lineage (why, from what, to what) is recorded. Uploaded files are only ever read by FFmpeg/ffprobe restricted to
 * local files and an allowlist of demuxers — never executed.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AudioMeasurement, MediaAnalysis, MediaCapabilityEntry, MediaCapabilityStatus, MediaIngestionSummary } from "./training-types.js";

export type SniffFamily = "VIDEO" | "AUDIO" | "AUDIO_OR_VIDEO" | "IMAGE" | "BLOCKED" | "UNKNOWN";
export type SupportTier = "SUPPORTED_DIRECTLY" | "SUPPORTED_AFTER_NORMALIZATION" | "UNSUPPORTED";

export const INGESTION_LIMITS = {
  maxVideoSec: Number(process.env.KWIZERA_TEACH_MAX_VIDEO_SEC) || 600,
  maxAudioSec: Number(process.env.KWIZERA_TEACH_MAX_AUDIO_SEC) || 1_200,
  maxPixels: 7_680 * 4_320,
  maxFps: 240,
  maxStreams: 32,
  /** Long side of the analysis derivative; analysis samples far below this, so nothing measurable is lost. */
  derivativeLongSide: 1_280,
  directMaxLongSide: 1_920,
};

/** Demuxers FFmpeg may use for teaching media. Playlists, concat lists, SDP, device and network demuxers are refused. */
const ALLOWED_DEMUXERS = new Set(["mov", "mp4", "m4a", "3gp", "3g2", "mj2", "matroska", "webm", "avi", "mpeg", "mpegts", "wav", "mp3", "flac", "ogg", "aac", "m4v"]);
const DIRECT_VIDEO_CONTAINERS = new Set(["mov", "mp4", "matroska", "webm"]);
const DIRECT_VIDEO_CODECS = new Set(["h264", "hevc", "vp8", "vp9", "av1", "mpeg4"]);
const DIRECT_AUDIO_CONTAINERS = new Set(["wav", "mp3", "flac", "ogg", "mov", "mp4", "m4a", "aac"]);
const DIRECT_AUDIO_CODECS = /^(pcm_[a-z0-9]+|mp3|aac|flac|vorbis|opus|alac)$/;

// ---------- type detection (content signature) ----------

const ascii = (b: Buffer, start: number, len: number) => b.subarray(start, start + len).toString("latin1");

/** Container family from the first bytes. BLOCKED = executables, archives, documents and text playlists (never media). */
export function sniffMedia(bytes: Buffer): { format: string; family: SniffFamily } {
  if (bytes.length < 4) return { format: "unknown", family: "UNKNOWN" };
  const u32 = bytes.readUInt32BE(0);
  if (ascii(bytes, 0, 2) === "MZ") return { format: "executable", family: "BLOCKED" };
  if (u32 === 0x7f454c46) return { format: "executable", family: "BLOCKED" };
  if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(u32)) return { format: "executable", family: "BLOCKED" };
  if (ascii(bytes, 0, 2) === "#!") return { format: "script", family: "BLOCKED" };
  if (u32 === 0x504b0304 || ascii(bytes, 0, 4) === "Rar!" || u32 === 0x377abcaf || (bytes[0] === 0x1f && bytes[1] === 0x8b)) return { format: "archive", family: "BLOCKED" };
  if (ascii(bytes, 0, 5) === "%PDF-") return { format: "pdf", family: "BLOCKED" };
  const head = ascii(bytes, 0, 64).replace(/^\uFEFF/, "").trimStart();
  if (/^(#EXTM3U|ffconcat|\[playlist\]|<\?xml|<MPD|v=0\r?\n)/i.test(head)) return { format: "playlist", family: "BLOCKED" };
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand === "qt  ") return { format: "mov", family: "AUDIO_OR_VIDEO" };
    if (/^M4[ABP] $/.test(brand)) return { format: "m4a", family: "AUDIO" };
    if (brand === "M4V " || brand === "M4VH" || brand === "M4VP") return { format: "m4v", family: "AUDIO_OR_VIDEO" };
    if (/^3g/.test(brand)) return { format: "3gp", family: "AUDIO_OR_VIDEO" };
    return { format: "mp4", family: "AUDIO_OR_VIDEO" };
  }
  if (u32 === 0x1a45dfa3) return { format: /webm/.test(ascii(bytes, 0, 64)) ? "webm" : "matroska", family: "AUDIO_OR_VIDEO" };
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF") {
    const type = ascii(bytes, 8, 4);
    if (type === "WAVE") return { format: "wav", family: "AUDIO" };
    if (type === "AVI ") return { format: "avi", family: "VIDEO" };
    if (type === "WEBP") return { format: "webp", family: "IMAGE" };
  }
  if (ascii(bytes, 0, 3) === "ID3") return { format: "mp3", family: "AUDIO" };
  if (ascii(bytes, 0, 4) === "fLaC") return { format: "flac", family: "AUDIO" };
  if (ascii(bytes, 0, 4) === "OggS") return { format: "ogg", family: "AUDIO_OR_VIDEO" };
  if (u32 === 0x000001ba || u32 === 0x000001b3) return { format: "mpeg", family: "VIDEO" };
  if (bytes[0] === 0x47 && bytes.length > 376 && bytes[188] === 0x47 && bytes[376] === 0x47) return { format: "mpegts", family: "VIDEO" };
  if (u32 === 0x89504e47) return { format: "png", family: "IMAGE" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { format: "jpeg", family: "IMAGE" };
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xf0) === 0xf0 && ((bytes[1] ?? 0) & 0x06) === 0) return { format: "aac", family: "AUDIO" };
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0) return { format: "mp3", family: "AUDIO" };
  return { format: "unknown", family: "UNKNOWN" };
}

// ---------- metadata probe ----------

export interface ProbedVideoStream { codec: string | null; width: number; height: number; fps: number | null; avgFps: number | null; variableFrameRate: boolean; pixFmt: string | null; rotation: number }
export interface ProbedAudioStream { codec: string | null; sampleRate: number | null; channels: number | null; bitrate: number | null }

export interface MediaProbe {
  container: string | null;
  /** First demuxer name reported by ffprobe (e.g. "mov" for "mov,mp4,m4a,3gp,3g2,mj2"). */
  demuxer: string | null;
  durationSec: number | null;
  durationSource: "FORMAT" | "STREAM" | null;
  bitrate: number | null;
  streams: number;
  video: ProbedVideoStream | null;
  audio: ProbedAudioStream | null;
  /** Embedded cover art is not a video. */
  attachedPictures: number;
}

interface FfprobeJson {
  format?: { format_name?: string; duration?: string; bit_rate?: string; nb_streams?: number };
  streams?: Array<{
    codec_type?: string; codec_name?: string; width?: number; height?: number; pix_fmt?: string; r_frame_rate?: string; avg_frame_rate?: string;
    sample_rate?: string; channels?: number; bit_rate?: string; duration?: string; disposition?: { attached_pic?: number };
    tags?: { rotate?: string }; side_data_list?: Array<{ rotation?: number | string }>;
  }>;
}

const rate = (r: string | undefined): number | null => {
  if (!r) return null;
  const [n, d] = r.split("/").map(Number);
  const v = d ? n! / d : Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
};
const positive = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Pure parser for ffprobe `-show_format -show_streams -of json` output (unit-testable without FFmpeg). */
export function parseProbe(json: FfprobeJson): MediaProbe {
  const streams = json.streams ?? [];
  const pictures = streams.filter((s) => s.codec_type === "video" && s.disposition?.attached_pic === 1);
  const v = streams.find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1 && s.width && s.height);
  const a = streams.find((s) => s.codec_type === "audio");
  const formatDuration = positive(json.format?.duration);
  const streamDuration = Math.max(0, ...streams.map((s) => positive(s.duration) ?? 0)) || null;
  let video: ProbedVideoStream | null = null;
  if (v) {
    const fps = rate(v.r_frame_rate);
    const avgFps = rate(v.avg_frame_rate);
    const rotationRaw = v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0;
    const rotation = ((Math.round(Number(rotationRaw) || 0) % 360) + 360) % 360;
    video = {
      codec: v.codec_name ?? null, width: v.width!, height: v.height!, fps, avgFps, pixFmt: v.pix_fmt ?? null, rotation,
      variableFrameRate: Boolean(fps && avgFps && Math.abs(fps - avgFps) / Math.max(fps, avgFps) > 0.02),
    };
  }
  const container = json.format?.format_name ?? null;
  return {
    container,
    demuxer: container ? container.split(",")[0]!.trim() : null,
    durationSec: formatDuration ?? streamDuration,
    durationSource: formatDuration ? "FORMAT" : streamDuration ? "STREAM" : null,
    bitrate: positive(json.format?.bit_rate),
    streams: streams.length,
    video,
    audio: a ? { codec: a.codec_name ?? null, sampleRate: positive(a.sample_rate), channels: positive(a.channels), bitrate: positive(a.bit_rate) } : null,
    attachedPictures: pictures.length,
  };
}

async function ffBinaries() {
  const { ffmpegBinary, ffprobeBinary } = await import("../video-production/ffmpeg-renderer.js");
  return { ffmpeg: ffmpegBinary(), ffprobe: ffprobeBinary() };
}

export async function probeMedia(filePath: string): Promise<MediaProbe> {
  const { ffprobe } = await ffBinaries();
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile(ffprobe, ["-v", "error", "-protocol_whitelist", "file", "-show_format", "-show_streams", "-of", "json", filePath],
      { timeout: 30_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, out) => (err ? reject(new IngestionError("PROBE_FAILED", "The file could not be read as audio or video.")) : resolve(String(out))));
  });
  try {
    return parseProbe(JSON.parse(stdout) as FfprobeJson);
  } catch {
    throw new IngestionError("PROBE_FAILED", "The file could not be read as audio or video.");
  }
}

// ---------- normalization plan ----------

export class IngestionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "IngestionError";
  }
}

export interface IngestionPlan {
  kind: "VIDEO" | "AUDIO";
  tier: SupportTier;
  /** Machine-readable reasons normalisation is required (empty for direct support). */
  reasons: string[];
  /** Customer-safe explanation when UNSUPPORTED. */
  error: { code: string; message: string } | null;
  target: "MP4_H264_AAC" | "FLAC" | null;
}

const unsupported = (kind: "VIDEO" | "AUDIO", code: string, message: string): IngestionPlan => ({ kind, tier: "UNSUPPORTED", reasons: [], error: { code, message }, target: null });

/** Decides what the file is (by its streams) and whether it can be analysed as-is. */
export function planIngestion(requested: "VIDEO" | "AUDIO", probe: MediaProbe): IngestionPlan {
  if (!probe.demuxer || !ALLOWED_DEMUXERS.has(probe.demuxer)) {
    return unsupported(requested, "UNSUPPORTED_CONTAINER", "This file format is not supported. Export video as MP4 (H.264) or audio as WAV, MP3 or M4A and upload it again.");
  }
  if (probe.streams > INGESTION_LIMITS.maxStreams) return unsupported(requested, "TOO_MANY_STREAMS", "The file contains too many tracks to analyse.");
  if (!probe.video && !probe.audio) return unsupported(requested, "NO_MEDIA_STREAM", "The file has no audio or video track that can be decoded.");
  const kind: "VIDEO" | "AUDIO" = probe.video ? (requested === "AUDIO" && probe.audio ? "AUDIO" : "VIDEO") : "AUDIO";
  const reasons: string[] = [];
  if (!probe.durationSec) reasons.push("NO_DURATION_HEADER");
  if (kind === "VIDEO") {
    const v = probe.video!;
    if (probe.durationSec && probe.durationSec > INGESTION_LIMITS.maxVideoSec) {
      return unsupported(kind, "VIDEO_TOO_LONG", `The video is longer than ${Math.round(INGESTION_LIMITS.maxVideoSec / 60)} minutes; trim it and upload again.`);
    }
    if (v.width * v.height > INGESTION_LIMITS.maxPixels) return unsupported(kind, "RESOLUTION_TOO_HIGH", "The video resolution is above 8K and cannot be analysed.");
    if ((v.avgFps ?? v.fps ?? 0) > INGESTION_LIMITS.maxFps) return unsupported(kind, "FRAME_RATE_TOO_HIGH", `The video frame rate is above ${INGESTION_LIMITS.maxFps} fps.`);
    if (!v.codec) return unsupported(kind, "UNDECODABLE_VIDEO", "The video track uses a codec this server cannot decode.");
    if (!DIRECT_VIDEO_CONTAINERS.has(probe.demuxer)) reasons.push(`CONTAINER_${probe.demuxer.toUpperCase()}`);
    if (!DIRECT_VIDEO_CODECS.has(v.codec)) reasons.push(`CODEC_${v.codec.toUpperCase()}`);
    if (v.variableFrameRate) reasons.push("VARIABLE_FRAME_RATE");
    if (v.rotation) reasons.push("ROTATION_METADATA");
    if (Math.max(v.width, v.height) > INGESTION_LIMITS.directMaxLongSide) reasons.push("RESOLUTION_ABOVE_ANALYSIS_SIZE");
    if (v.width % 2 || v.height % 2) reasons.push("ODD_DIMENSIONS");
    return { kind, tier: reasons.length ? "SUPPORTED_AFTER_NORMALIZATION" : "SUPPORTED_DIRECTLY", reasons, error: null, target: reasons.length ? "MP4_H264_AAC" : null };
  }
  const a = probe.audio;
  if (!a) return unsupported(kind, "NO_AUDIO_STREAM", "The file has no audio track.");
  if (probe.durationSec && probe.durationSec > INGESTION_LIMITS.maxAudioSec) {
    return unsupported(kind, "AUDIO_TOO_LONG", `The audio is longer than ${Math.round(INGESTION_LIMITS.maxAudioSec / 60)} minutes; trim it and upload again.`);
  }
  if (!a.codec) return unsupported(kind, "UNDECODABLE_AUDIO", "The audio track uses a codec this server cannot decode.");
  if (!DIRECT_AUDIO_CONTAINERS.has(probe.demuxer)) reasons.push(`CONTAINER_${probe.demuxer.toUpperCase()}`);
  if (!DIRECT_AUDIO_CODECS.test(a.codec)) reasons.push(`CODEC_${a.codec.toUpperCase()}`);
  if (probe.video) reasons.push("VIDEO_TRACK_DROPPED");
  return { kind, tier: reasons.length ? "SUPPORTED_AFTER_NORMALIZATION" : "SUPPORTED_DIRECTLY", reasons, error: null, target: reasons.length ? "FLAC" : null };
}

/** FFmpeg arguments for the analysis derivative (pure, unit-testable). */
export function normalizationArgs(plan: IngestionPlan, probe: MediaProbe, input: string, output: string): string[] {
  const common = ["-nostdin", "-hide_banner", "-v", "error", "-y", "-protocol_whitelist", "file", "-i", input];
  if (plan.kind === "AUDIO") {
    const channels = Math.min(2, probe.audio?.channels ?? 2);
    return [...common, "-map", "0:a:0", "-vn", "-sn", "-dn", "-t", String(INGESTION_LIMITS.maxAudioSec), "-ac", String(channels), "-c:a", "flac", output];
  }
  const v = probe.video!;
  const src = v.avgFps ?? v.fps;
  const fps = v.variableFrameRate || !src || src > 60 ? 30 : Math.round(src * 1000) / 1000;
  const L = INGESTION_LIMITS.derivativeLongSide;
  const vf = [
    `scale='if(gte(iw,ih),min(${L},iw),-2)':'if(gte(iw,ih),-2,min(${L},ih))'`,
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    `fps=${fps}`,
    "format=yuv420p",
  ].join(",");
  return [
    ...common, "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn", "-t", String(INGESTION_LIMITS.maxVideoSec), "-vf", vf,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", "2", "-c:a", "aac", "-b:a", "160k", "-ac", "2",
    "-movflags", "+faststart", "-max_muxing_queue_size", "1024", output,
  ];
}

// ---------- normalization (bounded) ----------

let running = 0;
const waiting: Array<() => void> = [];
const MAX_CONCURRENT = Math.max(1, Number(process.env.KWIZERA_TEACH_FFMPEG_CONCURRENCY) || 1);

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await fn();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

let swept = false;
async function sweepStaleDerivatives(): Promise<void> {
  if (swept) return;
  swept = true;
  const dir = os.tmpdir();
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const cutoff = Date.now() - 6 * 3_600_000;
  for (const name of names.filter((n) => n.startsWith("kwz-teach-"))) {
    const file = path.join(dir, name);
    const stat = await fs.stat(file).catch(() => null);
    if (stat?.isFile() && stat.mtimeMs < cutoff) await fs.rm(file, { force: true }).catch(() => undefined);
  }
}

export interface MediaIngestion {
  kind: "VIDEO" | "AUDIO";
  tier: Exclude<SupportTier, "UNSUPPORTED">;
  sniffed: string;
  probe: MediaProbe;
  /** File the analysers read: the original, or the temporary normalised derivative. */
  analysisPath: string;
  normalization: null | { reasons: string[]; target: "MP4_H264_AAC" | "FLAC"; derivative: MediaProbe; seconds: number; derivativeRetained: false };
  cleanup(): Promise<void>;
}

/** Runs the canonical ingestion; throws IngestionError (customer-safe message) when the file cannot be analysed. */
export async function ingestMedia(filePath: string, requested: "VIDEO" | "AUDIO"): Promise<MediaIngestion> {
  void sweepStaleDerivatives();
  const head = Buffer.alloc(512);
  const handle = await fs.open(filePath, "r");
  try {
    await handle.read(head, 0, 512, 0);
  } finally {
    await handle.close();
  }
  const sniff = sniffMedia(head);
  if (sniff.family === "BLOCKED") throw new IngestionError("NOT_MEDIA", "The file is not an audio or video file.");
  if (sniff.family === "IMAGE") throw new IngestionError("NOT_MEDIA", "The file is an image, not an audio or video file.");
  const probe = await probeMedia(filePath);
  const plan = planIngestion(requested, probe);
  if (plan.tier === "UNSUPPORTED") throw new IngestionError(plan.error!.code, plan.error!.message);
  const base = { kind: plan.kind, sniffed: sniff.format, probe };
  if (plan.tier === "SUPPORTED_DIRECTLY") return { ...base, tier: plan.tier, analysisPath: filePath, normalization: null, cleanup: async () => undefined };
  const out = path.join(os.tmpdir(), `kwz-teach-norm-${randomUUID()}${plan.target === "FLAC" ? ".flac" : ".mp4"}`);
  const started = Date.now();
  const expected = probe.durationSec ?? (plan.kind === "VIDEO" ? INGESTION_LIMITS.maxVideoSec : INGESTION_LIMITS.maxAudioSec);
  const timeout = Math.round(Math.min(15 * 60_000, 60_000 + expected * (plan.kind === "VIDEO" ? 3_000 : 500)));
  const { ffmpeg } = await ffBinaries();
  const ok = await withSlot(() => new Promise<boolean>((resolve) => {
    execFile(ffmpeg, normalizationArgs(plan, probe, filePath, out), { timeout, windowsHide: true, maxBuffer: 1024 * 1024 }, (err) => resolve(!err));
  }));
  const cleanup = async () => { await fs.rm(out, { force: true }).catch(() => undefined); };
  let derivative: MediaProbe | null = null;
  if (ok) derivative = await probeMedia(out).catch(() => null);
  const usable = derivative && derivative.durationSec && (plan.kind === "AUDIO" ? derivative.audio : derivative.video);
  if (!usable) {
    await cleanup();
    throw new IngestionError("NORMALIZATION_FAILED", plan.kind === "VIDEO"
      ? "The video could not be converted for analysis. Export it as MP4 (H.264) and upload it again."
      : "The audio could not be converted for analysis. Export it as WAV or MP3 and upload it again.");
  }
  return {
    ...base, tier: plan.tier, analysisPath: out, cleanup,
    normalization: { reasons: plan.reasons, target: plan.target!, derivative: derivative!, seconds: Math.round((Date.now() - started) / 100) / 10, derivativeRetained: false },
  };
}

export function ingestionSummary(ing: MediaIngestion): MediaIngestionSummary {
  const p = ing.probe;
  const d = ing.normalization?.derivative;
  return {
    tier: ing.tier, sniffed: ing.sniffed, container: p.container, durationSec: p.durationSec, durationSource: p.durationSource,
    video: p.video ? { codec: p.video.codec, width: p.video.width, height: p.video.height, fps: p.video.avgFps ?? p.video.fps, variableFrameRate: p.video.variableFrameRate, pixFmt: p.video.pixFmt, rotation: p.video.rotation } : null,
    audio: p.audio ? { codec: p.audio.codec, sampleRate: p.audio.sampleRate, channels: p.audio.channels } : null,
    normalization: ing.normalization && d ? {
      reasons: ing.normalization.reasons, description: describeNormalization(ing.normalization.reasons), target: ing.normalization.target,
      derivative: {
        container: d.container, durationSec: d.durationSec, codec: (ing.kind === "VIDEO" ? d.video?.codec : d.audio?.codec) ?? null,
        width: d.video?.width ?? null, height: d.video?.height ?? null, fps: d.video?.avgFps ?? d.video?.fps ?? null, sampleRate: d.audio?.sampleRate ?? null,
      },
      seconds: ing.normalization.seconds, derivativeRetained: false,
    } : null,
  };
}

// ---------- capability matrices ----------

const entry = (capability: string, status: MediaCapabilityStatus, detail: string, implemented = true, executable = true): MediaCapabilityEntry => ({ capability, implemented, executable, status, detail });
const fx = (v: unknown, digits: number) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "?");

export function audioCapabilityMatrix(a: AudioMeasurement | null, meta: { codec: string | null; sampleRate: number | null; channels: number | null; durationSec: number | null } | null): MediaCapabilityEntry[] {
  const failed = new Set(a?.failed ?? []);
  const signal = (name: string, ok: boolean, detail: string, none: string): MediaCapabilityEntry =>
    !a ? entry(name, "FAILED", "The audio could not be decoded.") : failed.has(name) ? entry(name, "FAILED", "This measurement failed; the others were kept.")
      : a.silent ? entry(name, "NO_RESULT", "The audio is silent.") : entry(name, ok ? "EXECUTED" : "NO_RESULT", ok ? detail : none);
  const tempoOk = a?.tempoStatus === "available" && typeof a.bpm === "number";
  const tempo: MediaCapabilityEntry = !a ? entry("TEMPO", "FAILED", "The audio could not be decoded.")
    : failed.has("TEMPO") ? entry("TEMPO", "FAILED", "Tempo estimation failed.")
      : tempoOk ? entry("TEMPO", "EXECUTED", `${Math.round(a.bpm!)} BPM (confidence ${fx(a.tempoConfidence, 2)})`)
        : a.tempoStatus === "low_confidence" ? entry("TEMPO", "LOW_CONFIDENCE", `Not reported: tempo confidence ${fx(a.tempoConfidence, 2)} is below the reliability threshold; BPM is not guessed.`)
          : entry("TEMPO", "NO_RESULT", `No reliable tempo (${String(a.tempoStatus).replace(/_/g, " ")}); BPM is not guessed.`);
  const beatStatus = (count: number, name: string, noun: string): MediaCapabilityEntry => {
    if (!a || failed.has(name)) return entry(name, "FAILED", `${noun} detection failed.`);
    if (!count) return entry(name, "NO_RESULT", `No ${noun.toLowerCase()} detected.`);
    return tempoOk ? entry(name, "EXECUTED", `${count} ${noun.toLowerCase()}(s)`) : entry(name, "LOW_CONFIDENCE", `${count} candidate ${noun.toLowerCase()}(s); tempo is unreliable, so they are not used as a grid.`);
  };
  return [
    meta ? entry("AUDIO_METADATA", "EXECUTED", `${meta.codec ?? "unknown codec"}, ${meta.sampleRate ?? "?"} Hz, ${meta.channels ?? "?"} ch, ${fx(meta.durationSec, 1)} s`) : entry("AUDIO_METADATA", "FAILED", "Metadata could not be read."),
    signal("WAVEFORM", Boolean(a), "RMS envelope measured on the decoded signal", "No waveform"),
    signal("LOUDNESS", a?.rmsDbfs != null, `RMS ${fx(a?.rmsDbfs, 1)} dBFS, peak ${fx(a?.peakDbfs, 1)} dBFS`, "No measurable level"),
    signal("SILENCE", Boolean(a), `${a?.silences?.length ?? 0} silent gap(s) ≥ 0.3 s`, ""),
    signal("ENERGY", Boolean(a?.energyTimeline?.length), `${a?.energyTimeline?.length ?? 0} energy window(s), ${a?.energyTransitions?.length ?? 0} transition(s)`, "No energy windows"),
    tempo,
    beatStatus(a?.beatCount ?? 0, "BEATS", "Beat"),
    beatStatus(a?.downbeatCount ?? 0, "DOWNBEATS", "Downbeat"),
    entry("SPEECH", "UNAVAILABLE", "No speech detection model is installed on this server.", false, false),
    entry("TRANSCRIPTION", "UNAVAILABLE", "No speech-to-text runtime is configured on this server.", false, false),
    signal("MUSIC_STRUCTURE", (a?.sections.length ?? 0) > 1, `${a?.sections.length ?? 0} section(s)`, "A single undivided section"),
  ];
}

export function videoCapabilityMatrix(base: MediaAnalysis, deep: { frames: number; scenes: unknown[]; sync: unknown; unavailable: string[]; observations?: Array<{ text?: { presence?: string } }> } | null, visionReady: boolean): MediaCapabilityEntry[] {
  const obs = deep?.observations ?? [];
  const deepEntry = (name: string, ok: boolean, detail: string, none: string) => (!deep ? entry(name, "FAILED", "Frame analysis failed.") : entry(name, ok ? "EXECUTED" : "NO_RESULT", ok ? detail : none));
  const visionUsed = Boolean(deep) && visionReady && !deep!.unavailable.some((u) => /vision/i.test(u));
  const audioTrack = !base.hasAudioStream ? entry("AUDIO_TRACK", "NO_RESULT", "The video has no audio track.")
    : base.audio ? entry("AUDIO_TRACK", "EXECUTED", "Audio track decoded and measured") : entry("AUDIO_TRACK", "FAILED", "The audio track could not be analysed.");
  return [
    entry("VIDEO_METADATA", "EXECUTED", `${base.width ?? "?"}×${base.height ?? "?"}, ${fx(base.durationSec, 1)} s, ${base.codec ?? "unknown codec"}`),
    entry("SCENE_DETECTION", base.sceneCount ? "EXECUTED" : "NO_RESULT", `${base.sceneCount ?? 0} shot(s)`),
    deepEntry("FRAME_ANALYSIS", (deep?.frames ?? 0) > 0, `${deep?.frames ?? 0} frame(s) decoded and measured`, "No frames decoded"),
    deepEntry("CAMERA_MOTION", obs.length > 0, `${obs.length} scene observation(s)`, "No scene observations"),
    deepEntry("TRANSITIONS", (deep?.scenes.length ?? 0) > 0, `${deep?.scenes.length ?? 0} scene boundary measurement(s)`, "No boundaries"),
    deepEntry("TEXT_REGIONS", obs.some((o) => o.text?.presence === "DETECTED"), `${obs.filter((o) => o.text?.presence === "DETECTED").length} scene(s) with text-like regions (located, not read)`, "No text-like regions located"),
    visionUsed ? entry("VISION", "EXECUTED", "Admin-routed vision capability described sampled frames")
      : entry("VISION", "UNAVAILABLE", visionReady ? "Vision was not used for this video." : "Admin VISION_ANALYSIS is not executable.", true, visionReady),
    entry("TEXT_READING", visionUsed ? "EXECUTED" : "UNAVAILABLE", visionUsed ? "Read through the vision capability" : "No OCR runtime; text is located but not read.", visionUsed, visionUsed),
    audioTrack,
    ...(base.audio ? audioCapabilityMatrix(base.audio, null).filter((c) => ["TEMPO", "BEATS", "ENERGY", "MUSIC_STRUCTURE"].includes(c.capability)) : []),
    deep?.sync ? entry("AUDIO_VISUAL_SYNC", "EXECUTED", "Cuts measured against the beat grid") : entry("AUDIO_VISUAL_SYNC", "NO_RESULT", "No reliable beat grid to measure cuts against."),
    entry("TRANSCRIPTION", "UNAVAILABLE", "No speech-to-text runtime is configured on this server.", false, false),
  ];
}

/** Human-readable reasons (no paths, no identifiers). */
export function describeNormalization(reasons: string[]): string {
  const label: Record<string, string> = {
    NO_DURATION_HEADER: "the container had no duration header", VARIABLE_FRAME_RATE: "variable frame rate", ROTATION_METADATA: "rotation metadata",
    RESOLUTION_ABOVE_ANALYSIS_SIZE: "resolution above the analysis size", ODD_DIMENSIONS: "odd frame dimensions", VIDEO_TRACK_DROPPED: "a video track (dropped for audio analysis)",
  };
  return reasons.map((r) => label[r] ?? r.replace(/^CONTAINER_/, "container ").replace(/^CODEC_/, "codec ").toLowerCase()).join(", ");
}
