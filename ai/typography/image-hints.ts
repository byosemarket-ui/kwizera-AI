/**
 * Load per-scene image hints for STEP 4 typography (luminance / path).
 * Uses existing asset resolver + visual-metrics when PNG is available.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { computeVisualMetrics } from "../image-intelligence/visual-metrics.js";
import type { TypographyComposeInput } from "./types.js";

export type TypographyImageHint = NonNullable<TypographyComposeInput["scenes"][number]["image"]>;

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

export async function buildTypographyImageHint(input: {
  imagePath?: string | null;
  composition?: string;
  brandColors?: string[];
}): Promise<TypographyImageHint> {
  const base: TypographyImageHint = {
    composition: input.composition,
    productLikelyCentered: !/edge|left|right/i.test(input.composition ?? ""),
    brandColors: input.brandColors,
    imagePath: input.imagePath ?? undefined,
  };
  if (!input.imagePath) return base;
  try {
    const bytes = await fs.readFile(input.imagePath);
    const metrics = computeVisualMetrics({
      bytes,
      mimeType: mimeFromPath(input.imagePath),
      sizeBytes: bytes.length,
    });
    return {
      ...base,
      meanLuminance: metrics.meanLuminance,
      backgroundType: metrics.backgroundObserved
        ?? (metrics.meanLuminance != null && metrics.meanLuminance < 80
          ? "dark"
          : metrics.meanLuminance != null && metrics.meanLuminance > 180
            ? "light"
            : undefined),
      backgroundComplexity: metrics.contrast != null && metrics.contrast > 45
        ? "high"
        : metrics.contrast != null && metrics.contrast < 18
          ? "low"
          : "medium",
      dominantColors: metrics.dominantColors?.slice(0, 3).map((c) => c.hex),
    };
  } catch {
    return base;
  }
}
