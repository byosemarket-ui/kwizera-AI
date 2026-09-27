/**
 * Phase 18 — measurement of teaching media with the existing media stack:
 * ffprobe (probeVideo/probeAudio), FFmpeg audio extraction, PCM decode + Audio Intelligence signal analysis,
 * image header dimensions, and the shared PDF text extractor. Measured values are authoritative.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AudioMeasurement, MediaAnalysis, MediaKind } from "./training-types.js";

export interface TeachingMediaAnalyzer {
  analyze(kind: MediaKind, filePath: string, mimeType: string): Promise<MediaAnalysis>;
}

export class MediaAnalysisError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "MediaAnalysisError";
  }
}

export const MEDIA_LIMITS: Record<MediaKind, { maxBytes: number; mimes: RegExp; exts: RegExp }> = {
  IMAGE: { maxBytes: 20 * 1024 * 1024, mimes: /^image\/(png|jpe?g|webp)$/, exts: /\.(png|jpe?g|webp)$/i },
  VIDEO: { maxBytes: 45 * 1024 * 1024, mimes: /^video\/(mp4|quicktime|webm|x-matroska)$/, exts: /\.(mp4|mov|webm|mkv)$/i },
  AUDIO: { maxBytes: 30 * 1024 * 1024, mimes: /^audio\/(mpeg|mp3|wav|x-wav|wave|ogg|mp4|x-m4a|aac|flac|x-flac)$/, exts: /\.(mp3|wav|ogg|m4a|aac|flac)$/i },
  DOCUMENT: { maxBytes: 40 * 1024 * 1024, mimes: /^(application\/pdf|text\/plain|text\/markdown|text\/x-markdown)$/, exts: /\.(pdf|txt|md|markdown)$/i },
};

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

export function aspectLabel(width: number, height: number): string {
  if (!width || !height) return "unknown";
  const ratio = width / height;
  const known: Array<[string, number]> = [["9:16", 9 / 16], ["16:9", 16 / 9], ["1:1", 1], ["4:5", 4 / 5], ["4:3", 4 / 3], ["3:4", 3 / 4], ["21:9", 21 / 9]];
  for (const [label, value] of known) if (Math.abs(ratio - value) / value < 0.02) return label;
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
}

function round(n: number, digits = 3): number {
  return Number(n.toFixed(digits));
}

/** Loudness/clipping measured on the decoded mono PCM (dBFS, sample-peak based). */
export function measureLevels(samples: Float32Array): { rmsDbfs: number | null; peakDbfs: number | null; clippedRatio: number } {
  if (!samples.length) return { rmsDbfs: null, peakDbfs: null, clippedRatio: 0 };
  let sum = 0;
  let peak = 0;
  let clipped = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.abs(samples[i] ?? 0);
    sum += v * v;
    if (v > peak) peak = v;
    if (v >= 0.999) clipped += 1;
  }
  const rms = Math.sqrt(sum / samples.length);
  const db = (x: number) => (x > 0 ? round(20 * Math.log10(x), 2) : null);
  return { rmsDbfs: db(rms), peakDbfs: db(peak), clippedRatio: round(clipped / samples.length, 6) };
}

async function analyzeAudioFile(filePath: string): Promise<AudioMeasurement> {
  const { decodeAudioToMonoPcm } = await import("../audio-intelligence/pcm-decode.js");
  const { analyzeDecodedPcm } = await import("../audio-intelligence/analyze-signal.js");
  const { probeAudio } = await import("../video-production/ffmpeg-renderer.js");
  const probed = await probeAudio(filePath);
  const pcm = await decodeAudioToMonoPcm(filePath);
  const signal = analyzeDecodedPcm(pcm);
  const levels = measureLevels(pcm.samples);
  return {
    durationSec: round(pcm.durationSec || probed.durationMs / 1000),
    sampleRate: probed.sampleRate,
    channels: probed.channels,
    codec: probed.codec,
    bpm: signal.tempo.bpm,
    tempoConfidence: round(signal.tempo.confidence),
    tempoStatus: signal.tempo.status,
    beatCount: signal.beats.length,
    downbeatCount: signal.downbeats.length,
    firstBeats: signal.beats.slice(0, 16).map((b) => round(b.time)),
    sections: signal.sections.slice(0, 24).map((s) => ({ label: s.label, start: round(s.start, 2), end: round(s.end, 2) })),
    ...levels,
    silent: signal.technical.silent,
  };
}

/** Scene-change timestamps from FFmpeg's scene score (bounded; no frames are written). */
async function detectSceneChanges(filePath: string, durationSec: number): Promise<number[]> {
  const { ffmpegBinary } = await import("../video-production/ffmpeg-renderer.js");
  const timeout = Math.min(180_000, 20_000 + durationSec * 1_500);
  const stderr = await new Promise<string>((resolve) => {
    execFile(ffmpegBinary(), [
      "-nostdin", "-hide_banner", "-i", filePath,
      "-an", "-vf", "scale=320:-2,select='gt(scene,0.32)',showinfo", "-f", "null", "-",
    ], { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (_err, _stdout, err) => resolve(String(err ?? "")));
  });
  const times: number[] = [];
  for (const match of stderr.matchAll(/pts_time:([0-9.]+)/g)) {
    const t = Number(match[1]);
    if (Number.isFinite(t) && (!times.length || t - times[times.length - 1]! > 0.2)) times.push(round(t, 2));
    if (times.length >= 200) break;
  }
  return times;
}

export function createTeachingMediaAnalyzer(): TeachingMediaAnalyzer {
  return {
    async analyze(kind, filePath, mimeType) {
      const notes: string[] = [];
      if (kind === "IMAGE") {
        const { readDimensions } = await import("../image-preparation/validation.js");
        const bytes = await fs.readFile(filePath);
        const dims = readDimensions(bytes);
        if (!dims?.width || !dims.height) throw new MediaAnalysisError("IMAGE_UNREADABLE", "Image dimensions could not be read.");
        return { kind, width: dims.width, height: dims.height, aspectRatio: aspectLabel(dims.width, dims.height), notes };
      }
      if (kind === "AUDIO") {
        let audio: AudioMeasurement;
        try {
          audio = await analyzeAudioFile(filePath);
        } catch (err) {
          throw new MediaAnalysisError("AUDIO_UNREADABLE", err instanceof Error && !/[\\/]/.test(err.message) ? err.message : "The audio file could not be decoded.");
        }
        if (audio.silent) notes.push("The audio is silent.");
        if (audio.tempoStatus !== "available") notes.push(`Tempo ${audio.tempoStatus.replace(/_/g, " ")}.`);
        return { kind, durationSec: audio.durationSec, codec: audio.codec, audio, notes };
      }
      if (kind === "VIDEO") {
        const { probeVideo, extractAudioFromVideo } = await import("../video-production/ffmpeg-renderer.js");
        let probed;
        try {
          probed = await probeVideo(filePath);
        } catch {
          throw new MediaAnalysisError("VIDEO_UNREADABLE", "The video could not be read.");
        }
        const durationSec = round(probed.durationMs / 1000);
        const sceneChanges = await detectSceneChanges(filePath, durationSec).catch(() => {
          notes.push("Scene detection failed.");
          return [] as number[];
        });
        const cuts = [0, ...sceneChanges, durationSec];
        const shots = cuts.slice(1).map((t, i) => t - cuts[i]!).filter((d) => d > 0.05);
        let audio: AudioMeasurement | null = null;
        if (probed.hasAudioStream) {
          const tmp = path.join(os.tmpdir(), `kwz-teach-${randomUUID()}.m4a`);
          try {
            await extractAudioFromVideo(filePath, tmp);
            audio = await analyzeAudioFile(tmp);
          } catch {
            notes.push("The video's audio track could not be analysed.");
          } finally {
            await fs.rm(tmp, { force: true }).catch(() => undefined);
          }
        } else notes.push("The video has no audio track.");
        return {
          kind,
          width: probed.width,
          height: probed.height,
          aspectRatio: aspectLabel(probed.width, probed.height),
          durationSec,
          codec: probed.codec,
          hasAudioStream: probed.hasAudioStream,
          sceneChanges,
          sceneCount: shots.length,
          meanShotSec: shots.length ? round(shots.reduce((a, b) => a + b, 0) / shots.length, 2) : null,
          audio,
          notes: [...notes, "No transcript: speech recognition is not installed on this server."],
        };
      }
      throw new MediaAnalysisError("UNSUPPORTED_MEDIA", `Unsupported media kind for ${mimeType}.`);
    },
  };
}

/** Human-readable, measured description placed in the teaching package (no paths, no identifiers). */
export function describeAnalysis(analysis: MediaAnalysis | null, roleLabel: string): string {
  if (!analysis) return `${roleLabel}: not analysed.`;
  const parts: string[] = [];
  if (analysis.width && analysis.height) parts.push(`${analysis.width}×${analysis.height} (${analysis.aspectRatio})`);
  if (analysis.durationSec) parts.push(`${analysis.durationSec.toFixed(1)} s`);
  if (analysis.sceneCount) parts.push(`${analysis.sceneCount} shots${analysis.meanShotSec ? `, mean shot ${analysis.meanShotSec.toFixed(1)} s` : ""}`);
  const a = analysis.audio;
  if (a) {
    parts.push(a.bpm ? `measured tempo ${Math.round(a.bpm)} BPM (confidence ${a.tempoConfidence.toFixed(2)})` : `tempo ${a.tempoStatus.replace(/_/g, " ")}`);
    parts.push(`${a.beatCount} beats, ${a.downbeatCount} downbeats`);
    if (a.sections.length) parts.push(`sections ${a.sections.slice(0, 6).map((s) => `${s.label} ${s.start.toFixed(0)}–${s.end.toFixed(0)} s`).join(", ")}`);
    if (a.rmsDbfs !== null) parts.push(`loudness ${a.rmsDbfs.toFixed(1)} dBFS RMS, peak ${a.peakDbfs?.toFixed(1)} dBFS`);
    parts.push(a.clippedRatio > 0 ? `clipping ${(a.clippedRatio * 100).toFixed(3)}% of samples` : "no clipping");
  }
  if (analysis.document) parts.push(`${analysis.document.pages} pages, ${analysis.document.headings.length} headings`);
  return `${roleLabel} (measured): ${parts.join("; ") || "no measurable properties"}.`;
}
