/**
 * Deterministic media checks for I2V scene clips before assembly.
 * Does not claim AI identity verification — truthful uncertainty when vision QA is unavailable.
 */

import fs from "node:fs/promises";
import { probeVideo } from "./ffmpeg-renderer.js";

export interface I2vSceneValidationInput {
  videoPath: string;
  expectedDurationSeconds: number;
  /** Soft tolerance around expected duration. */
  durationToleranceSeconds?: number;
}

export interface I2vSceneValidationResult {
  ok: boolean;
  status: "ACCEPTED" | "FAILED";
  fileExists: boolean;
  readable: boolean;
  mimeOk: boolean;
  durationMs: number | null;
  durationOk: boolean;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  issues: string[];
  warnings: string[];
  /** Product identity vision QA is not asserted in Phase 4 media checks. */
  productIdentityVerified: false;
}

export async function validateI2vSceneClip(
  input: I2vSceneValidationInput,
): Promise<I2vSceneValidationResult> {
  const issues: string[] = [];
  const warnings: string[] = [];
  let fileExists = false;
  let sizeBytes = 0;
  let readable = false;
  let durationMs: number | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let mimeOk = false;
  let durationOk = false;

  try {
    const stat = await fs.stat(input.videoPath);
    fileExists = stat.isFile();
    sizeBytes = stat.size;
    if (!fileExists) issues.push("Video file is not a regular file");
    if (sizeBytes < 1_024) issues.push("Video file is empty or corrupt");
  } catch {
    issues.push("Video file does not exist");
  }

  if (fileExists && sizeBytes >= 1_024) {
    try {
      const probed = await probeVideo(input.videoPath);
      readable = true;
      durationMs = probed.durationMs;
      width = probed.width;
      height = probed.height;
      mimeOk = probed.durationMs > 0 && probed.width > 0 && probed.height > 0;
      if (!mimeOk) issues.push("ffprobe could not decode a valid video stream");

      const expectedMs = Math.max(1_000, Math.round(input.expectedDurationSeconds * 1000));
      const tol = Math.max(500, Math.round((input.durationToleranceSeconds ?? 2.5) * 1000));
      durationOk = Math.abs(probed.durationMs - expectedMs) <= tol
        || (probed.durationMs >= 1_200 && probed.durationMs <= expectedMs + tol + 2_000);
      if (!durationOk) {
        warnings.push(
          `Scene duration ${probed.durationMs}ms differs from expected ~${expectedMs}ms`,
        );
        // Soft fail only when extremely short / empty motion.
        if (probed.durationMs < 800) {
          issues.push("Scene duration is too short to be usable");
          durationOk = false;
        } else {
          durationOk = true;
        }
      }
      if (probed.width < 64 || probed.height < 64) {
        issues.push("Scene resolution is too small");
      }
    } catch {
      issues.push("ffprobe failed to inspect the generated scene");
      readable = false;
    }
  }

  const ok = issues.length === 0 && fileExists && readable && mimeOk && durationOk;
  return {
    ok,
    status: ok ? "ACCEPTED" : "FAILED",
    fileExists,
    readable,
    mimeOk,
    durationMs,
    durationOk,
    sizeBytes,
    width,
    height,
    issues,
    warnings,
    productIdentityVerified: false,
  };
}
