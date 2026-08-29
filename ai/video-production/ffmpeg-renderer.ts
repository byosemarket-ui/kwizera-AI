import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import type { VideoMotionId, VideoRenderPlan, VideoTimelineClip, VideoTransitionId } from "./types.js";

const execFileAsync = promisify(execFile);

export interface RenderClipInput {
  clip: VideoTimelineClip;
  imagePath: string;
}

export interface ProbedVideo {
  durationMs: number;
  width: number;
  height: number;
  codec: string;
  sizeBytes: number;
}

export function ffmpegBinary(): string {
  return process.env.KWIZERA_FFMPEG_PATH || "ffmpeg";
}

export function ffprobeBinary(): string {
  return process.env.KWIZERA_FFPROBE_PATH || "ffprobe";
}

export async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync(ffmpegBinary(), ["-version"], { timeout: 8000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function zoompan(motion: VideoMotionId, frames: number, width: number, height: number): string {
  const d = Math.max(24, frames);
  const s = `${width}x${height}`;
  switch (motion) {
    case "zoom-out":
      return `zoompan=z='1.12-0.12*on/${d}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${s}:fps=24`;
    case "pan-left":
      return `zoompan=z='1.08':x='(iw-iw/zoom)*on/${d}':y='ih/2-(ih/zoom/2)':d=${d}:s=${s}:fps=24`;
    case "pan-right":
      return `zoompan=z='1.08':x='(iw-iw/zoom)*(1-on/${d})':y='ih/2-(ih/zoom/2)':d=${d}:s=${s}:fps=24`;
    case "pan-up":
      return `zoompan=z='1.08':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*on/${d}':d=${d}:s=${s}:fps=24`;
    case "pan-down":
      return `zoompan=z='1.08':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(1-on/${d})':d=${d}:s=${s}:fps=24`;
    case "image-reveal":
      return `zoompan=z='min(1.04+0.001*on,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${s}:fps=24`;
    case "hold":
      return `zoompan=z='1':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${s}:fps=24`;
    case "slow-zoom":
    default:
      return `zoompan=z='min(1.0+0.08*on/${d},1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${s}:fps=24`;
  }
}

function fadeFilter(transition: VideoTransitionId, durationMs: number): string {
  if (transition !== "fade") return "";
  const seconds = Math.max(1, durationMs) / 1000;
  const fade = Math.min(0.25, seconds / 4);
  return `fade=t=in:st=0:d=${fade},fade=t=out:st=${Math.max(0, seconds - fade)}:d=${fade}`;
}

function drawtextFilter(clip: VideoTimelineClip, fontFile?: string): string {
  const layer = clip.text[0];
  if (!layer?.content || !fontFile) return "";
  const escaped = layer.content.replace(/\\/g, "\\\\").replace(/'/g, "").replace(/:/g, "\\:").slice(0, 80);
  const y = layer.position === "top" ? "h*0.08" : layer.position === "center" ? "(h-text_h)/2" : "h*0.86";
  const font = fontFile.replace(/\\/g, "/").replace(/:/g, "\\:");
  return `drawtext=fontfile='${font}':text='${escaped}':fontsize=22:fontcolor=white:borderw=1:bordercolor=black@0.6:x=(w-text_w)/2:y=${y}`;
}

export async function resolveFontFile(): Promise<string | undefined> {
  const candidates = [
    process.env.KWIZERA_FONT_FILE,
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
  ].filter((item): item is string => Boolean(item));
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

function stillFilter(
  input: RenderClipInput,
  plan: VideoRenderPlan,
  options: { motion: boolean; fade: boolean; text: boolean; fontFile?: string },
): string {
  const frames = Math.max(24, Math.round(plan.frameRate * input.clip.durationMs / 1000));
  const parts = [
    `scale=${plan.width}:${plan.height}:force_original_aspect_ratio=increase`,
    `crop=${plan.width}:${plan.height}`,
  ];
  if (options.motion) {
    parts.push(zoompan(input.clip.motion, frames, plan.width, plan.height));
  }
  if (options.fade) {
    const fade = fadeFilter(
      input.clip.transitionOut === "fade" || input.clip.transitionIn === "fade" ? "fade" : "cut",
      input.clip.durationMs,
    );
    if (fade) parts.push(fade);
  }
  if (options.text) {
    const text = drawtextFilter(input.clip, options.fontFile);
    if (text) parts.push(text);
  }
  return parts.join(",");
}

export async function renderStillClip(
  input: RenderClipInput,
  plan: VideoRenderPlan,
  outputPath: string,
  fontFile?: string,
): Promise<void> {
  if (!path.isAbsolute(input.imagePath) || !path.isAbsolute(outputPath)) {
    throw new Error("FFmpeg paths must be absolute");
  }
  await fs.access(input.imagePath);
  const seconds = Math.max(1, input.clip.durationMs / 1000);
  const attempts: Array<{ motion: boolean; fade: boolean; text: boolean }> = [
    { motion: true, fade: true, text: Boolean(fontFile) },
    { motion: true, fade: true, text: false },
    { motion: false, fade: false, text: false },
  ];
  let lastError: Error | undefined;
  for (const attempt of attempts) {
    try {
      await runFfmpeg([
        "-y", "-loop", "1", "-i", input.imagePath,
        "-vf", stillFilter(input, plan, { ...attempt, fontFile }),
        "-t", String(seconds),
        "-r", String(plan.frameRate),
        "-an",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "veryfast",
        "-crf", "28",
        "-movflags", "+faststart",
        outputPath,
      ], 5 * 60_000);
      const stat = await fs.stat(outputPath).catch(() => null);
      if (stat?.size) return;
      lastError = new Error("FFmpeg did not produce a scene clip");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("FFmpeg did not produce a scene clip");
}

export async function concatClips(clipPaths: string[], outputPath: string): Promise<void> {
  if (!clipPaths.length) throw new Error("No clips to concatenate");
  const listPath = `${outputPath}.concat.txt`;
  const body = clipPaths.map((clip) => {
    const escaped = clip.replace(/\\/g, "/").replace(/'/g, "'\\''");
    return `file '${escaped}'`;
  }).join("\n");
  await fs.writeFile(listPath, `${body}\n`, "utf8");
  try {
    await runFfmpeg([
      "-y", "-f", "concat", "-safe", "0", "-i", listPath,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart",
      "-preset", "veryfast", "-crf", "28",
      outputPath,
    ], 8 * 60_000);
  } finally {
    await fs.rm(listPath, { force: true });
  }
  const stat = await fs.stat(outputPath).catch(() => null);
  if (!stat?.size) throw new Error("FFmpeg did not produce a concatenated video");
}

export async function probeVideo(filePath: string): Promise<ProbedVideo> {
  const { stdout } = await execFileAsync(ffprobeBinary(), [
    "-v", "error",
    "-show_entries", "format=duration,size:stream=width,height,codec_name,codec_type",
    "-of", "json",
    filePath,
  ], { timeout: 15_000, windowsHide: true, maxBuffer: 1024 * 1024 });
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string; size?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number }>;
  };
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const durationMs = Math.round(Number(parsed.format?.duration ?? 0) * 1000);
  const sizeBytes = Number(parsed.format?.size ?? 0);
  if (!video?.width || !video.height || durationMs < 200 || sizeBytes < 100) {
    throw new Error("Rendered media is not a valid video");
  }
  return {
    durationMs,
    width: video.width,
    height: video.height,
    codec: video.codec_name ?? "h264",
    sizeBytes,
  };
}

async function runFfmpeg(args: string[], timeout: number): Promise<void> {
  try {
    await execFileAsync(ffmpegBinary(), args, { timeout, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`FFmpeg failed: ${detail}`);
  }
}
