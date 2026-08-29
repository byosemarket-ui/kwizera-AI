/**
 * Deterministic visual metrics from decoded pixels or image headers.
 * Never invents product identity. Labels unavailable AI vision honestly.
 */
import { inspectImageBuffer } from "../creative-workspace/image-inspect.js";
import { decodePngRgba } from "../creative-workspace/png-pixels.js";

export const ANALYSIS_VERSION = "step6-v1";

export interface DominantColor {
  hex: string;
  r: number;
  g: number;
  b: number;
  share: number;
  name: string;
}

export interface VisualMetrics {
  method: "deterministic-pixels" | "metadata-only";
  pixelAnalysisAvailable: boolean;
  aiVisionStatus: "IMAGE_ANALYSIS_UNAVAILABLE";
  provider: "local-deterministic-image-processing" | "local-image-header";
  width?: number;
  height?: number;
  aspectRatio?: number;
  meanLuminance?: number;
  contrast?: number;
  borderUniformity?: number;
  transparencyShare?: number;
  dominantColors: DominantColor[];
  backgroundObserved?: "uniform-light" | "uniform-dark" | "mixed" | "unavailable";
  lightingObserved?: string;
  cleanlinessObserved?: string;
  notes: string[];
}

const SAMPLE_STRIDE_TARGET = 80_000;

export function computeVisualMetrics(input: {
  bytes: Buffer | null;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes: number;
}): VisualMetrics {
  const header = input.bytes ? inspectImageBuffer(input.bytes, input.mimeType) : null;
  const width = (header && header.ok ? header.width : undefined) ?? input.width;
  const height = (header && header.ok ? header.height : undefined) ?? input.height;
  const aspectRatio = width && height ? Number((width / height).toFixed(4)) : undefined;
  const notes: string[] = [
    "No vision model is configured. AI image analysis is unavailable.",
    "Deterministic header and pixel processing still run when the file is readable.",
  ];

  if (!input.bytes) {
    return {
      method: "metadata-only",
      pixelAnalysisAvailable: false,
      aiVisionStatus: "IMAGE_ANALYSIS_UNAVAILABLE",
      provider: "local-image-header",
      width,
      height,
      aspectRatio,
      dominantColors: [],
      backgroundObserved: "unavailable",
      lightingObserved: "unavailable without pixel decode",
      notes: [...notes, "Original bytes were not readable for pixel sampling."],
    };
  }

  const decoded = input.mimeType === "image/png" ? decodePngRgba(input.bytes) : null;
  if (!decoded) {
    notes.push(input.mimeType === "image/png"
      ? "PNG pixel decode was skipped or failed; using header metadata only."
      : `Pixel sampling is not implemented for ${input.mimeType}; dimensions still come from the file header.`);
    return {
      method: "metadata-only",
      pixelAnalysisAvailable: false,
      aiVisionStatus: "IMAGE_ANALYSIS_UNAVAILABLE",
      provider: "local-image-header",
      width,
      height,
      aspectRatio,
      dominantColors: [],
      backgroundObserved: "unavailable",
      lightingObserved: "unavailable without pixel decode",
      notes,
    };
  }

  const sampled = samplePixels(decoded.rgba, decoded.width, decoded.height);
  const backgroundObserved = sampled.borderUniformity >= 0.82
    ? sampled.meanLuminance >= 200 ? "uniform-light" : sampled.meanLuminance <= 40 ? "uniform-dark" : "mixed"
    : sampled.borderUniformity >= 0 ? "mixed" : "unavailable";
  const lightingObserved = sampled.meanLuminance >= 180
    ? "bright / studio-like luminance observed"
    : sampled.meanLuminance <= 50
      ? "low luminance observed"
      : "moderate luminance observed";
  const cleanlinessObserved = sampled.borderUniformity >= 0.85 && sampled.contrast >= 18
    ? "clean subject-vs-border separation observed"
    : sampled.borderUniformity < 0.45
      ? "busy or mixed border observed"
      : "moderate visual cleanliness observed";

  return {
    method: "deterministic-pixels",
    pixelAnalysisAvailable: true,
    aiVisionStatus: "IMAGE_ANALYSIS_UNAVAILABLE",
    provider: "local-deterministic-image-processing",
    width: decoded.width,
    height: decoded.height,
    aspectRatio: Number((decoded.width / decoded.height).toFixed(4)),
    meanLuminance: sampled.meanLuminance,
    contrast: sampled.contrast,
    borderUniformity: sampled.borderUniformity,
    transparencyShare: sampled.transparencyShare,
    dominantColors: sampled.dominantColors,
    backgroundObserved,
    lightingObserved,
    cleanlinessObserved,
    notes: [
      ...notes,
      `Decoded ${decoded.width}×${decoded.height} PNG pixels for luminance, contrast, border uniformity, and dominant colors.`,
      `Source size ${input.sizeBytes} bytes.`,
    ],
  };
}

function samplePixels(rgba: Buffer, width: number, height: number): {
  meanLuminance: number;
  contrast: number;
  borderUniformity: number;
  transparencyShare: number;
  dominantColors: DominantColor[];
} {
  const total = width * height;
  const stride = Math.max(1, Math.ceil(total / SAMPLE_STRIDE_TARGET));
  let luminanceSum = 0;
  let luminanceSq = 0;
  let count = 0;
  let transparent = 0;
  const histogram = new Map<number, number>();
  const border: number[] = [];
  const insetX = Math.max(1, Math.floor(width * 0.08));
  const insetY = Math.max(1, Math.floor(height * 0.08));

  for (let i = 0; i < total; i += stride) {
    const offset = i * 4;
    const r = rgba[offset] ?? 0;
    const g = rgba[offset + 1] ?? 0;
    const b = rgba[offset + 2] ?? 0;
    const a = rgba[offset + 3] ?? 255;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminanceSum += y;
    luminanceSq += y * y;
    count += 1;
    if (a < 250) transparent += 1;
    const quantized = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    histogram.set(quantized, (histogram.get(quantized) ?? 0) + 1);
    const x = i % width;
    const py = Math.floor(i / width);
    if (x < insetX || x >= width - insetX || py < insetY || py >= height - insetY) {
      border.push(y);
    }
  }

  const mean = count ? luminanceSum / count : 0;
  const variance = count ? Math.max(0, luminanceSq / count - mean * mean) : 0;
  const contrast = Math.sqrt(variance);
  const borderMean = border.length ? border.reduce((sum, value) => sum + value, 0) / border.length : mean;
  const borderVar = border.length
    ? border.reduce((sum, value) => sum + (value - borderMean) ** 2, 0) / border.length
    : 0;
  const borderUniformity = Number((1 / (1 + Math.sqrt(borderVar) / 32)).toFixed(4));

  const ranked = [...histogram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const histTotal = ranked.reduce((sum, [, n]) => sum + n, 0) || 1;
  const dominantColors = ranked.map(([key, n]) => {
    const r = ((key >> 8) & 0xf) * 17;
    const g = ((key >> 4) & 0xf) * 17;
    const b = (key & 0xf) * 17;
    return {
      hex: `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`,
      r,
      g,
      b,
      share: Number((n / histTotal).toFixed(4)),
      name: nameColor(r, g, b),
    };
  });

  return {
    meanLuminance: Number(mean.toFixed(2)),
    contrast: Number(contrast.toFixed(2)),
    borderUniformity,
    transparencyShare: Number((transparent / Math.max(1, count)).toFixed(4)),
    dominantColors,
  };
}

function nameColor(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 40) return "Black";
  if (min > 220) return "White";
  if (max - min < 18) return r > 160 ? "Gray" : "Gray";
  if (r >= g && r >= b) return g > 150 && b < 80 ? "Gold" : "Red";
  if (g >= r && g >= b) return "Green";
  if (b >= r && b >= g) return r > 80 ? "Purple" : "Blue";
  return "Mixed";
}
