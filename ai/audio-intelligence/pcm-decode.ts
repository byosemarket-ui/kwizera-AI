/**
 * Decode library audio to mono float32 PCM via existing FFmpeg binary.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ffmpegBinary, probeAudio, FfmpegAudioError } from "../video-production/ffmpeg-renderer.js";

export const ANALYSIS_SAMPLE_RATE = 22050;

export interface DecodedPcm {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
  channels: 1;
  codec: string | null;
  bitrate: number | null;
  format: string | null;
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBinary(), ["-nostdin", "-hide_banner", "-loglevel", "error", ...args], {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`FFmpeg timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    let err = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      err += chunk.toString("utf8");
      if (err.length > 4000) err = err.slice(-4000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(err.trim() || `FFmpeg exited with code ${code}`));
    });
  });
}

/** Decode to mono f32le at ANALYSIS_SAMPLE_RATE. Cleans temp files. */
export async function decodeAudioToMonoPcm(audioPath: string): Promise<DecodedPcm> {
  let probed;
  try {
    probed = await probeAudio(audioPath);
  } catch (error) {
    if (error instanceof FfmpegAudioError) throw error;
    throw new FfmpegAudioError("DECODE_FAILED", "The audio file could not be decoded.");
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-ai-pcm-"));
  const rawPath = path.join(tmpDir, `${randomUUID()}.f32`);
  try {
    await runFfmpeg([
      "-y", "-i", audioPath,
      "-ac", "1",
      "-ar", String(ANALYSIS_SAMPLE_RATE),
      "-f", "f32le",
      rawPath,
    ], 3 * 60_000);

    const buf = await fs.readFile(rawPath);
    if (buf.length < 4) {
      throw new FfmpegAudioError("DECODE_FAILED", "The audio file could not be decoded.");
    }
    const sampleCount = Math.floor(buf.length / 4);
    const samples = new Float32Array(sampleCount);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    for (let i = 0; i < sampleCount; i++) {
      samples[i] = view.getFloat32(i * 4, true);
    }
    const durationSec = sampleCount / ANALYSIS_SAMPLE_RATE;
    return {
      samples,
      sampleRate: ANALYSIS_SAMPLE_RATE,
      durationSec,
      channels: 1,
      codec: probed.codec,
      bitrate: probed.bitrate,
      format: probed.container,
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
