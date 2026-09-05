import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import type { VideoMotionId, VideoRenderPlan, VideoTextOverlayStatus, VideoTimelineClip, VideoTransitionId } from "./types.js";
import { sanitizeRenderText } from "./ffmpeg-sanitize.js";

export { sanitizeRenderText } from "./ffmpeg-sanitize.js";

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

export async function ffprobeAvailable(): Promise<boolean> {
  try {
    await execFileAsync(ffprobeBinary(), ["-version"], { timeout: 8000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function zoompan(
  motion: VideoMotionId,
  frames: number,
  width: number,
  height: number,
  params?: {
    maxZoom?: number;
    focusX?: number;
    focusY?: number;
    intensity?: number;
  },
): string {
  const d = Math.max(24, frames);
  const s = `${width}x${height}`;
  const maxZ = Math.max(1, Math.min(1.2, params?.maxZoom ?? 1.08));
  const intensity = Math.max(0.35, Math.min(1, params?.intensity ?? 0.6));
  const fx = clamp01(params?.focusX ?? 0.5);
  const fy = clamp01(params?.focusY ?? 0.5);
  // Keep focus inside the zoomed viewport.
  const xExpr = `(iw-iw/zoom)*${fx.toFixed(3)}`;
  const yExpr = `(ih-ih/zoom)*${fy.toFixed(3)}`;
  const ramp = Number(((maxZ - 1) * intensity).toFixed(4));
  const startReveal = Number((1 + Math.min(0.04, ramp * 0.4)).toFixed(3));

  switch (motion) {
    case "zoom-out": {
      const start = Math.max(maxZ, 1.04).toFixed(3);
      return `zoompan=z='${start}-(${start}-1)*on/${d}':x='${xExpr}':y='${yExpr}':d=${d}:s=${s}:fps=24`;
    }
    case "pan-left":
      return `zoompan=z='${maxZ.toFixed(3)}':x='(iw-iw/zoom)*on/${d}':y='${yExpr}':d=${d}:s=${s}:fps=24`;
    case "pan-right":
      return `zoompan=z='${maxZ.toFixed(3)}':x='(iw-iw/zoom)*(1-on/${d})':y='${yExpr}':d=${d}:s=${s}:fps=24`;
    case "pan-up":
      return `zoompan=z='${maxZ.toFixed(3)}':x='${xExpr}':y='(ih-ih/zoom)*on/${d}':d=${d}:s=${s}:fps=24`;
    case "pan-down":
      return `zoompan=z='${maxZ.toFixed(3)}':x='${xExpr}':y='(ih-ih/zoom)*(1-on/${d})':d=${d}:s=${s}:fps=24`;
    case "image-reveal":
      return `zoompan=z='min(${startReveal}+${(ramp / Math.max(d, 1)).toFixed(6)}*on,${maxZ.toFixed(3)})':x='${xExpr}':y='${yExpr}':d=${d}:s=${s}:fps=24`;
    case "hold":
      return `zoompan=z='1':x='${xExpr}':y='${yExpr}':d=${d}:s=${s}:fps=24`;
    case "slow-zoom":
    default:
      return `zoompan=z='min(1.0+${ramp.toFixed(4)}*on/${d},${maxZ.toFixed(3)})':x='${xExpr}':y='${yExpr}':d=${d}:s=${s}:fps=24`;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function fadeFilter(transition: VideoTransitionId, durationMs: number): string {
  if (transition !== "fade") return "";
  const seconds = Math.max(1, durationMs) / 1000;
  const fade = Math.min(0.25, seconds / 4);
  return `fade=t=in:st=0:d=${fade},fade=t=out:st=${Math.max(0, seconds - fade)}:d=${fade}`;
}

function drawtextFilterLegacy(clip: VideoTimelineClip, plan: VideoRenderPlan, fontFile?: string): string {
  if (!fontFile || !clip.text.length) return "";
  const font = fontFile.replace(/\\/g, "/").replace(/:/g, "\\:");
  const scale = Math.max(1, Math.round(Math.min(plan.width, plan.height) / 480));
  const filters: string[] = [];
  const bottomLayers = clip.text.filter((layer) => layer.position === "bottom");
  const topLayers = clip.text.filter((layer) => layer.position === "top" || layer.position === "center");
  for (const layer of topLayers.slice(0, 1)) {
    const escaped = sanitizeRenderText(layer.content);
    if (!escaped) continue;
    const fontSize = 22 * scale;
    const y = layer.position === "center" ? "(h-text_h)/2" : `h*${plan.aspectRatio === "9:16" ? "0.12" : "0.08"}`;
    filters.push(
      `drawtext=fontfile='${font}':text='${escaped}':fontsize=${fontSize}:fontcolor=white:borderw=${Math.max(1, scale)}:bordercolor=black@0.6:x=(w-text_w)/2:y=${y}`,
    );
  }
  bottomLayers.slice(0, 3).forEach((layer, index) => {
    const escaped = sanitizeRenderText(layer.content);
    if (!escaped) return;
    const isWas = layer.kind === "price_was";
    const isSave = layer.kind === "price_save";
    const fontSize = (isWas ? 16 : isSave ? 18 : layer.kind === "price" ? 26 : 20) * scale;
    const baseY = plan.aspectRatio === "9:16" ? 0.82 : 0.86;
    const offset = index * (plan.aspectRatio === "9:16" ? 0.06 : 0.05);
    const y = `h*${Math.max(0.55, baseY - offset)}`;
    const color = isSave ? "0xFFD966" : "white";
    filters.push(
      `drawtext=fontfile='${font}':text='${escaped}':fontsize=${fontSize}:fontcolor=${color}:borderw=${Math.max(1, scale)}:bordercolor=black@0.6:x=(w-text_w)/2:y=${y}`,
    );
  });
  return filters.join(",");
}

/** Prefer validated typography; fall back to legacy drawtext stacking. */
export async function drawtextFilter(
  clip: VideoTimelineClip,
  plan: VideoRenderPlan,
  fontFile?: string,
): Promise<string> {
  const hasTypography = clip.text.some((layer) => layer.typography?.fontId || layer.typography?.lines?.length);
  if (hasTypography) {
    const { buildDrawtextFilter } = await import("../typography/drawtext-integration.js");
    const built = await buildDrawtextFilter(clip, plan, fontFile);
    if (built.filter) return built.filter;
  }
  return drawtextFilterLegacy(clip, plan, fontFile);
}

export async function resolveFontFile(): Promise<string | undefined> {
  const { resolveVerifiedFontFile } = await import("../typography/font-registry.js");
  const discovered = await resolveVerifiedFontFile();
  if (discovered) return discovered;
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

export function classifyTextOverlay(input: {
  hasText: boolean;
  fontAvailable: boolean;
  drawtextSucceeded?: boolean;
}): VideoTextOverlayStatus {
  if (!input.hasText) return "skipped";
  if (!input.fontAvailable) return "unavailable";
  if (input.drawtextSucceeded === false) return "failed";
  return "applied";
}

export async function stillFilter(
  input: RenderClipInput,
  plan: VideoRenderPlan,
  options: { motion: boolean; fade: boolean; text: boolean; fontFile?: string },
): Promise<string> {
  const frames = Math.max(24, Math.round(plan.frameRate * input.clip.durationMs / 1000));
  const cropFocusX = clamp01(
    input.clip.motionParams?.cropFocusX
      ?? input.clip.cameraPlan?.cropFocusX
      ?? 0.5,
  );
  const cropFocusY = clamp01(
    input.clip.motionParams?.cropFocusY
      ?? input.clip.cameraPlan?.cropFocusY
      ?? 0.5,
  );
  // STEP 9 — subject-aware cover crop (not fixed center).
  const parts = [
    `scale=${plan.width}:${plan.height}:force_original_aspect_ratio=increase`,
    `crop=${plan.width}:${plan.height}:(iw-ow)*${cropFocusX.toFixed(3)}:(ih-oh)*${cropFocusY.toFixed(3)}`,
  ];
  if (options.motion) {
    parts.push(zoompan(input.clip.motion, frames, plan.width, plan.height, input.clip.motionParams));
  }
  if (options.fade) {
    const fade = fadeFilter(
      input.clip.transitionOut === "fade" || input.clip.transitionIn === "fade" ? "fade" : "cut",
      input.clip.durationMs,
    );
    if (fade) parts.push(fade);
  }
  if (options.text) {
    const text = await drawtextFilter(input.clip, plan, options.fontFile);
    if (text) parts.push(text);
  }
  return parts.join(",");
}

/** Exported for STEP 7 unit tests — builds the zoompan expression with safety params. */
export function buildZoompanFilter(
  motion: VideoMotionId,
  frames: number,
  width: number,
  height: number,
  params?: { maxZoom?: number; focusX?: number; focusY?: number; intensity?: number },
): string {
  return zoompan(motion, frames, width, height, params);
}

export interface RenderClipResult {
  overlay: VideoTextOverlayStatus;
}

export async function renderStillClip(
  input: RenderClipInput,
  plan: VideoRenderPlan,
  outputPath: string,
  fontFile?: string,
): Promise<RenderClipResult> {
  if (!path.isAbsolute(input.imagePath) || !path.isAbsolute(outputPath)) {
    throw new Error("FFmpeg paths must be absolute");
  }
  await fs.access(input.imagePath);
  const seconds = Math.max(1, input.clip.durationMs / 1000);
  const x264Preset = plan.x264Preset ?? (plan.preset === "standard" ? "medium" : "ultrafast");
  const crf = plan.crf ?? (plan.preset === "standard" ? 23 : 28);
  const frameRate = plan.frameRate ?? (plan.preset === "standard" ? 24 : 15);
  const hasText = input.clip.text.some((layer) => layer.content?.trim() || layer.typography?.lines?.length);
  const useMotion = plan.preset === "standard";
  const useFade = plan.preset === "standard";

  const encode = async (text: boolean, motion = useMotion, fade = useFade) => {
    const vf = await stillFilter(input, plan, { motion, fade, text, fontFile });
    const args = plan.preset === "preview"
      ? [
        "-y", "-loop", "1", "-framerate", String(frameRate), "-i", input.imagePath,
        "-vf", vf,
        "-frames:v", String(Math.max(12, Math.round(frameRate * seconds))),
        "-an",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", x264Preset,
        "-tune", "stillimage",
        "-crf", String(crf),
        "-threads", "2",
        "-movflags", "+faststart",
        outputPath,
      ]
      : [
        "-y", "-loop", "1", "-i", input.imagePath,
        "-vf", vf,
        "-t", String(seconds),
        "-r", String(plan.frameRate),
        "-an",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", x264Preset,
        "-crf", String(crf),
        "-movflags", "+faststart",
        outputPath,
      ];
    await runFfmpeg(args, plan.preset === "preview" ? 180_000 : 5 * 60_000);
    const stat = await fs.stat(outputPath).catch(() => null);
    if (!stat?.size) throw new Error("FFmpeg did not produce a scene clip");
  };

  const encodeBare = async () => {
    const vf = await stillFilter(input, plan, { motion: false, fade: false, text: false, fontFile });
    await runFfmpeg([
      "-y", "-loop", "1", "-i", input.imagePath,
      "-vf", vf,
      "-t", String(seconds),
      "-r", String(frameRate),
      "-an",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-preset", x264Preset,
      "-crf", String(crf),
      "-movflags", "+faststart",
      outputPath,
    ], 5 * 60_000);
    const stat = await fs.stat(outputPath).catch(() => null);
    if (!stat?.size) throw new Error("FFmpeg did not produce a scene clip");
  };

  if (!hasText) {
    try {
      await encode(false, plan.preset === "standard", plan.preset === "standard");
    } catch {
      if (plan.preset === "preview") {
        try {
          await encode(false, false, false);
        } catch {
          await encodeBare();
        }
      } else {
        await encodeBare();
      }
    }
    return { overlay: classifyTextOverlay({ hasText: false, fontAvailable: Boolean(fontFile) }) };
  }
  if (!fontFile) {
    try {
      await encode(false, false, false);
    } catch {
      await encodeBare();
    }
    return { overlay: classifyTextOverlay({ hasText: true, fontAvailable: false }) };
  }
  try {
    await encode(true, useMotion, useFade);
    return { overlay: classifyTextOverlay({ hasText: true, fontAvailable: true, drawtextSucceeded: true }) };
  } catch {
    try {
      // Retry with typography but without motion/fade (safer drawtext path).
      await encode(true, false, false);
      return { overlay: classifyTextOverlay({ hasText: true, fontAvailable: true, drawtextSucceeded: true }) };
    } catch {
      try {
        await encode(false, false, false);
      } catch {
        await encodeBare();
      }
      return { overlay: classifyTextOverlay({ hasText: true, fontAvailable: true, drawtextSucceeded: false }) };
    }
  }
}

export async function concatClips(
  clipPaths: string[],
  outputPath: string,
  encode?: { x264Preset?: string; crf?: number },
): Promise<void> {
  if (!clipPaths.length) throw new Error("No clips to concatenate");
  const listPath = `${outputPath}.concat.txt`;
  const body = clipPaths.map((clip) => {
    const escaped = clip.replace(/\\/g, "/").replace(/'/g, "'\\''");
    return `file '${escaped}'`;
  }).join("\n");
  await fs.writeFile(listPath, `${body}\n`, "utf8");
  const x264Preset = encode?.x264Preset ?? "veryfast";
  const crf = encode?.crf ?? 28;
  try {
    await runFfmpeg([
      "-y", "-f", "concat", "-safe", "0", "-i", listPath,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart",
      "-preset", x264Preset, "-crf", String(crf),
      outputPath,
    ], 8 * 60_000);
  } finally {
    await fs.rm(listPath, { force: true });
  }
  const stat = await fs.stat(outputPath).catch(() => null);
  if (!stat?.size) throw new Error("FFmpeg did not produce a concatenated video");
}

export async function probeVideo(filePath: string): Promise<ProbedVideo> {
  const available = await ffprobeAvailable();
  if (!available) throw new Error("ffprobe is not available on this host");
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.size) throw new Error("Rendered output file is missing or empty");
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
  const sizeBytes = Number(parsed.format?.size ?? 0) || stat.size;
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
  const stderrTail: string[] = [];
  const maxTailChars = 8192;
  let tailLen = 0;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegBinary(), ["-nostdin", "-hide_banner", "-loglevel", "error", ...args], {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`FFmpeg timed out after ${timeout}ms`));
    }, timeout);

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderrTail.push(text);
      tailLen += text.length;
      while (tailLen > maxTailChars && stderrTail.length) {
        const removed = stderrTail.shift() ?? "";
        tailLen -= removed.length;
      }
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      const detail = stderrTail.join("").trim() || `exit code ${code ?? "unknown"}`;
      const wrapped = new Error(`FFmpeg failed: ${detail}`) as Error & { ffmpegExitCode?: number };
      if (typeof code === "number") wrapped.ffmpegExitCode = code;
      reject(wrapped);
    });
  });
}
