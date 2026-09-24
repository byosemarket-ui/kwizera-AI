/**
 * Phase 7 — small FFmpeg image helpers (server only): grayscale rasters, edit-mask derivation, re-encode.
 * Reuses the existing FFmpeg binary resolution from the renderer.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ffmpegBinary } from "../video-production/ffmpeg-renderer.js";
import { RASTER_SIZE } from "./validation.js";

const execFileAsync = promisify(execFile);

export async function readGrayRaster(filePath: string, size = RASTER_SIZE): Promise<Uint8Array | null> {
  try {
    const { stdout } = await execFileAsync(
      ffmpegBinary(),
      [
        "-v", "error",
        "-i", filePath,
        "-vf", `scale=${size}:${size}:flags=area,format=gray`,
        "-frames:v", "1",
        "-f", "rawvideo",
        "-pix_fmt", "gray",
        "pipe:1",
      ],
      { encoding: "buffer", timeout: 20_000, maxBuffer: size * size * 4, windowsHide: true },
    );
    const bytes = stdout as unknown as Buffer;
    return bytes.length >= size * size ? new Uint8Array(bytes.subarray(0, size * size)) : null;
  } catch {
    return null;
  }
}

/**
 * Derives the editable-region mask (white = environment) from a product mask.
 * Erosion keeps a small protective margin around product edges.
 */
export async function writeEditableRegionMask(
  productMaskPath: string,
  outputPath: string,
  productMaskInverted: boolean,
): Promise<boolean> {
  const filter = productMaskInverted
    ? "format=gray,erosion,erosion"
    : "format=gray,negate,erosion,erosion";
  try {
    await execFileAsync(
      ffmpegBinary(),
      ["-v", "error", "-y", "-i", productMaskPath, "-vf", filter, "-frames:v", "1", outputPath],
      { timeout: 20_000, windowsHide: true },
    );
    return true;
  } catch {
    return false;
  }
}

/** Keeps I2V upload size bounded without changing framing. */
export async function reencodeJpeg(inputPath: string, outputPath: string): Promise<boolean> {
  try {
    await execFileAsync(
      ffmpegBinary(),
      ["-v", "error", "-y", "-i", inputPath, "-frames:v", "1", "-q:v", "3", outputPath],
      { timeout: 30_000, windowsHide: true },
    );
    return true;
  } catch {
    return false;
  }
}
