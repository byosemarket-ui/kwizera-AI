/**
 * STEP 4 — analyze the REAL text placement region (not whole-frame average alone).
 * Reuses PNG decode from creative-workspace; does not invent a second image pipeline.
 */
import fs from "node:fs/promises";
import { decodePngRgba } from "../creative-workspace/png-pixels.js";
import type { TextBoundingArea } from "./types.js";

export interface RegionAnalysis {
  meanLuminance01: number;
  /** 0–255 luminance mean for compatibility with visual-metrics. */
  meanLuminance255: number;
  luminanceStd01: number;
  complexity: "low" | "medium" | "high";
  transparencyShare: number;
  dominantHex?: string;
  sampleCount: number;
  source: "region-pixels" | "frame-mean" | "heuristic";
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Relative luminance of sRGB channel 0–255 (WCAG). */
export function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminanceRgb(r: number, g: number, b: number): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** WCAG contrast ratio between two relative luminances (0–1). */
export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  const named: Record<string, { r: number; g: number; b: number }> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    "near-white": { r: 245, g: 245, b: 245 },
    "near-black": { r: 20, g: 20, b: 20 },
  };
  const key = color.trim().toLowerCase();
  if (named[key]) return named[key]!;
  const hex = color.trim().match(/^#?([0-9a-f]{6})$/i);
  if (hex) {
    const n = Number.parseInt(hex[1]!, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const ox = color.trim().match(/^0x([0-9a-f]{6})$/i);
  if (ox) {
    const n = Number.parseInt(ox[1]!, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  return null;
}

export function textColorLuminance(color: string): number {
  const rgb = parseColorToRgb(color);
  if (!rgb) return 1;
  return relativeLuminanceRgb(rgb.r, rgb.g, rgb.b);
}

/** Normalize mean luminance that may be 0–1 or 0–255. */
export function normalizeLuminance01(value?: number): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  if (value <= 1) return clamp01(value);
  return clamp01(value / 255);
}

export function analyzeRegionFromRgba(
  rgba: Buffer,
  width: number,
  height: number,
  area: TextBoundingArea,
): RegionAnalysis {
  const x0 = Math.max(0, Math.floor(area.x * width));
  const y0 = Math.max(0, Math.floor(area.y * height));
  const x1 = Math.min(width, Math.ceil((area.x + Math.max(0.02, area.width)) * width));
  const y1 = Math.min(height, Math.ceil((area.y + Math.max(0.02, area.height)) * height));
  const regionW = Math.max(1, x1 - x0);
  const regionH = Math.max(1, y1 - y0);
  const total = regionW * regionH;
  const stride = Math.max(1, Math.ceil(total / 12_000));

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  let transparent = 0;
  const histogram = new Map<number, number>();

  for (let y = y0; y < y1; y += Math.max(1, Math.floor(Math.sqrt(stride)))) {
    for (let x = x0; x < x1; x += Math.max(1, Math.floor(Math.sqrt(stride)))) {
      const offset = (y * width + x) * 4;
      const r = rgba[offset] ?? 0;
      const g = rgba[offset + 1] ?? 0;
      const b = rgba[offset + 2] ?? 0;
      const a = rgba[offset + 3] ?? 255;
      const yLin = relativeLuminanceRgb(r, g, b);
      sum += yLin;
      sumSq += yLin * yLin;
      count += 1;
      if (a < 250) transparent += 1;
      const quantized = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      histogram.set(quantized, (histogram.get(quantized) ?? 0) + 1);
    }
  }

  const mean = count ? sum / count : 0.5;
  const variance = count ? Math.max(0, sumSq / count - mean * mean) : 0;
  const std = Math.sqrt(variance);
  const complexity: RegionAnalysis["complexity"] = std > 0.22 ? "high" : std > 0.1 ? "medium" : "low";
  let dominantHex: string | undefined;
  const top = [...histogram.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) {
    const key = top[0];
    const r = ((key >> 8) & 0xf) * 17;
    const g = ((key >> 4) & 0xf) * 17;
    const b = (key & 0xf) * 17;
    dominantHex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  }

  return {
    meanLuminance01: Number(mean.toFixed(4)),
    meanLuminance255: Number((mean * 255).toFixed(2)),
    luminanceStd01: Number(std.toFixed(4)),
    complexity,
    transparencyShare: Number((transparent / Math.max(1, count)).toFixed(4)),
    dominantHex,
    sampleCount: count,
    source: "region-pixels",
  };
}

export async function analyzeRegionFromImagePath(
  imagePath: string,
  area: TextBoundingArea,
): Promise<RegionAnalysis | null> {
  try {
    const bytes = await fs.readFile(imagePath);
    const decoded = decodePngRgba(bytes);
    if (!decoded) return null;
    return analyzeRegionFromRgba(decoded.rgba, decoded.width, decoded.height, area);
  } catch {
    return null;
  }
}

/** Heuristic region stats when pixels are unavailable. */
export function regionFromHints(input: {
  meanLuminance?: number;
  backgroundType?: string;
  complexity?: string;
  dominantHex?: string;
}): RegionAnalysis {
  const lum = normalizeLuminance01(input.meanLuminance);
  const darkLabel = /dark|black|night/i.test(input.backgroundType ?? "");
  const lightLabel = /light|white|bright|studio/i.test(input.backgroundType ?? "");
  const meanLuminance01 = lum ?? (darkLabel ? 0.18 : lightLabel ? 0.85 : 0.55);
  const complex = /high|complex|clutter|lifestyle/i.test(input.complexity ?? "")
    || /cluttered|lifestyle/i.test(input.backgroundType ?? "");
  return {
    meanLuminance01,
    meanLuminance255: meanLuminance01 * 255,
    luminanceStd01: complex ? 0.28 : 0.08,
    complexity: complex ? "high" : "low",
    transparencyShare: 0,
    dominantHex: input.dominantHex,
    sampleCount: 0,
    source: lum != null ? "frame-mean" : "heuristic",
  };
}
