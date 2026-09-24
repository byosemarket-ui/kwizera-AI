/**
 * Phase 7 — deterministic validation of segmentation masks and derived images.
 * Pure functions over small grayscale rasters (produced by FFmpeg on the server).
 * These checks never claim AI identity verification.
 */

import { inspectImageBuffer } from "../creative-workspace/image-inspect.js";

export const RASTER_SIZE = 64;

export interface Dimensions {
  width: number;
  height: number;
}

export interface MaskRasterAnalysis {
  coverage: number;
  binaryRatio: number;
  bbox: { x0: number; y0: number; x1: number; y1: number } | null;
  pointInside: boolean | null;
}

/** point is normalized 0..1 (product target). */
export function analyzeMaskRaster(
  gray: Uint8Array,
  width: number,
  height: number,
  point?: { x: number; y: number } | null,
  invert = false,
): MaskRasterAnalysis {
  const total = width * height;
  if (!total || gray.length < total) {
    return { coverage: 0, binaryRatio: 0, bbox: null, pointInside: null };
  }
  let white = 0;
  let binary = 0;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const raw = gray[y * width + x]!;
      const v = invert ? 255 - raw : raw;
      if (v <= 32 || v >= 223) binary += 1;
      if (v >= 128) {
        white += 1;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  let pointInside: boolean | null = null;
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    const px = Math.min(width - 1, Math.max(0, Math.round(point.x * (width - 1))));
    const py = Math.min(height - 1, Math.max(0, Math.round(point.y * (height - 1))));
    const raw = gray[py * width + px]!;
    pointInside = (invert ? 255 - raw : raw) >= 128;
  }
  return {
    coverage: white / total,
    binaryRatio: binary / total,
    bbox: x1 >= 0 ? { x0, y0, x1, y1 } : null,
    pointInside,
  };
}

export interface MaskValidationResult {
  ok: boolean;
  /** Provider mask had the product black / background white; consumers must flip it. */
  inverted: boolean;
  coverage: number;
  issues: string[];
}

const MIN_COVERAGE = 0.01;
const MAX_COVERAGE = 0.97;

function coverageIssues(analysis: MaskRasterAnalysis): string[] {
  const issues: string[] = [];
  if (analysis.coverage < MIN_COVERAGE) issues.push("Mask is empty");
  if (analysis.coverage > MAX_COVERAGE) issues.push("Mask covers the entire frame");
  const box = analysis.bbox;
  if (box && (box.x1 - box.x0 < 2 || box.y1 - box.y0 < 2)) issues.push("Mask geometry is degenerate");
  return issues;
}

export function validateMask(input: {
  source: Dimensions;
  mask: Dimensions | null;
  raster: Uint8Array | null;
  rasterWidth?: number;
  rasterHeight?: number;
  targetPoint?: { x: number; y: number } | null;
}): MaskValidationResult {
  const issues: string[] = [];
  if (!input.mask) {
    return { ok: false, inverted: false, coverage: 0, issues: ["Mask image is missing or unreadable"] };
  }
  if (input.mask.width !== input.source.width || input.mask.height !== input.source.height) {
    issues.push(
      `Mask dimensions ${input.mask.width}x${input.mask.height} do not match source ${input.source.width}x${input.source.height}`,
    );
  }
  if (!input.raster) {
    return { ok: false, inverted: false, coverage: 0, issues: [...issues, "Mask pixels could not be decoded"] };
  }
  const w = input.rasterWidth ?? RASTER_SIZE;
  const h = input.rasterHeight ?? RASTER_SIZE;
  const direct = analyzeMaskRaster(input.raster, w, h, input.targetPoint);
  if (direct.binaryRatio < 0.85) {
    issues.push("Segmentation output is not a binary mask");
    return { ok: false, inverted: false, coverage: direct.coverage, issues };
  }

  const directIssues = coverageIssues(direct);
  if (directIssues.length === 0 && direct.pointInside !== false) {
    return { ok: issues.length === 0, inverted: false, coverage: direct.coverage, issues };
  }

  // Some providers return background-white masks; accept only when the flipped mask covers the product point.
  const flipped = analyzeMaskRaster(input.raster, w, h, input.targetPoint, true);
  if (direct.pointInside === false && flipped.pointInside === true && coverageIssues(flipped).length === 0) {
    return { ok: issues.length === 0, inverted: true, coverage: flipped.coverage, issues };
  }

  if (direct.pointInside === false) issues.push("Mask does not cover the product");
  issues.push(...directIssues);
  return { ok: false, inverted: false, coverage: direct.coverage, issues };
}

/** Mean absolute difference (0..255) between two rasters, optionally limited to mask-white pixels. */
export function rasterDelta(
  a: Uint8Array,
  b: Uint8Array,
  mask?: { raster: Uint8Array; inverted: boolean } | null,
): number | null {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i += 1) {
    if (mask) {
      const raw = mask.raster[i] ?? 0;
      const v = mask.inverted ? 255 - raw : raw;
      if (v < 128) continue;
    }
    sum += Math.abs(a[i]! - b[i]!);
    count += 1;
  }
  return count ? sum / count : null;
}

/** Product pixels should be nearly untouched by a mask-guided edit. */
export const PRODUCT_REGION_MAX_DELTA = 28;
/** Enhancement must not change image content, only detail. */
export const ENHANCEMENT_MAX_DELTA = 20;

export interface DerivedImageValidation {
  ok: boolean;
  dimensions: Dimensions | null;
  issues: string[];
}

export function validateDerivedImage(input: {
  bytes: Buffer | null;
  source: Dimensions;
  expectLarger?: boolean;
  aspectTolerance?: number;
  minSide?: number;
}): DerivedImageValidation {
  const issues: string[] = [];
  if (!input.bytes || input.bytes.length < 1_024) {
    return { ok: false, dimensions: null, issues: ["Derived image is missing or empty"] };
  }
  const inspected = inspectImageBuffer(input.bytes, "");
  if (!inspected.ok) {
    return { ok: false, dimensions: null, issues: [inspected.message] };
  }
  if (!inspected.width || !inspected.height) {
    return { ok: false, dimensions: null, issues: ["Derived image dimensions could not be read"] };
  }
  const dims = { width: inspected.width, height: inspected.height };
  const minSide = input.minSide ?? 256;
  if (Math.min(dims.width, dims.height) < minSide) issues.push("Derived image resolution is too small");
  const srcAspect = input.source.width / input.source.height;
  const outAspect = dims.width / dims.height;
  const tolerance = input.aspectTolerance ?? 0.05;
  if (Math.abs(outAspect - srcAspect) / srcAspect > tolerance) {
    issues.push("Derived image aspect ratio differs from the source (possible crop or distortion)");
  }
  if (input.expectLarger && dims.width * dims.height <= input.source.width * input.source.height) {
    issues.push("Enhanced image is not larger than its input");
  }
  return { ok: issues.length === 0, dimensions: dims, issues };
}

export function readDimensions(bytes: Buffer | null): Dimensions | null {
  if (!bytes) return null;
  const inspected = inspectImageBuffer(bytes, "");
  if (!inspected.ok || !inspected.width || !inspected.height) return null;
  return { width: inspected.width, height: inspected.height };
}
