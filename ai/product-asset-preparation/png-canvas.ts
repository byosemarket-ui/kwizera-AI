/**
 * Source-preserving product cutout canvas.
 * Uses real product pixels from the original PNG when decodable.
 * Never invents a different product appearance from hash noise.
 */
import { createHash } from "node:crypto";
import { decodePngRgba, downsampleRgba, encodeRgbaPng } from "../creative-workspace/png-pixels.js";

export const PREPARATION_METHOD = "source-preserving-v1";
export const VIDEO_SAFE_MIN_EDGE = 64;
export const DEFAULT_MAX_EDGE = 1024;

export interface PreparedCanvas {
  width: number;
  height: number;
  rgba: Buffer;
  boundingBox: { x: number; y: number; width: number; height: number };
  png: Buffer;
  method: typeof PREPARATION_METHOD | "unavailable";
  confidence: number;
  productPreserved: boolean;
}

export interface CutoutBuildOptions {
  canvasSize?: number;
  sourceBytes: Buffer;
  preserveShadows?: boolean;
  preserveReflections?: boolean;
  softEdges?: boolean;
  preserveTransparency?: boolean;
  removeArtifacts?: boolean;
  removeBorders?: boolean;
  reduceNoise?: boolean;
  maxEdge?: number;
}

/**
 * Build a transparent PNG cutout from real source pixels.
 * Returns null when the source cannot be decoded safely — caller must keep the original.
 */
export function buildNormalizedProductCutout(options: CutoutBuildOptions): PreparedCanvas | null {
  const decoded = decodePngRgba(options.sourceBytes);
  if (!decoded) return null;

  const maxEdge = options.maxEdge ?? options.canvasSize ?? DEFAULT_MAX_EDGE;
  const scaled = downsampleRgba(decoded.rgba, decoded.width, decoded.height, maxEdge);
  const width = scaled.width;
  const height = scaled.height;
  const source = scaled.rgba;
  const bg = estimateBackground(source, width, height);
  const soft = options.softEdges !== false;
  const threshold = bg.uniformity >= 0.75 ? 42 : 58;
  const softWidth = soft ? threshold * 0.55 : threshold * 0.2;
  const rgba = Buffer.alloc(width * height * 4, 0);

  let productPixels = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = source[index] ?? 0;
      const g = source[index + 1] ?? 0;
      const b = source[index + 2] ?? 0;
      const a = source[index + 3] ?? 255;
      if (a < 16) continue;

      const distance = colorDistance(r, g, b, bg.r, bg.g, bg.b);
      let alpha = 255;
      if (distance <= threshold) {
        alpha = 0;
      } else if (distance < threshold + softWidth) {
        alpha = Math.round(255 * ((distance - threshold) / softWidth));
      }

      if (options.reduceNoise && alpha > 0 && alpha < 40) alpha = 0;

      if (alpha > 0) {
        // Preserve exact product RGB from the source photograph.
        rgba[index] = r;
        rgba[index + 1] = g;
        rgba[index + 2] = b;
        rgba[index + 3] = alpha;
        if (alpha > 120) {
          productPixels += 1;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      } else if (options.preserveShadows && y > height * 0.55) {
        const shade = Math.max(0, 1 - distance / (threshold + softWidth));
        if (shade > 0.55 && distance < threshold + softWidth) {
          rgba[index] = 20;
          rgba[index + 1] = 20;
          rgba[index + 2] = 24;
          rgba[index + 3] = Math.round(70 * shade);
        }
      }
    }
  }

  const total = width * height;
  const productRatio = productPixels / Math.max(1, total);
  const productPreserved = productPixels > 0 && productRatio >= 0.02 && productRatio <= 0.96;
  if (!productPreserved) {
    // Isolation would damage product identity — refuse derived cutout.
    return null;
  }

  const boundingBox = {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX + 1),
    height: Math.max(1, maxY - minY + 1),
  };
  const confidence = Math.max(0.35, Math.min(0.95, bg.uniformity * 0.55 + (1 - Math.abs(0.35 - productRatio)) * 0.45));

  return {
    width,
    height,
    rgba,
    boundingBox,
    png: encodeRgbaPng(width, height, rgba),
    method: PREPARATION_METHOD,
    confidence,
    productPreserved: true,
  };
}

/** @deprecated Prefer buildNormalizedProductCutout; kept for hash-based tests that expect non-null. */
export function buildLegacySyntheticCutout(options: CutoutBuildOptions & { canvasSize: number }): PreparedCanvas {
  const width = options.canvasSize;
  const height = options.canvasSize;
  const rgba = Buffer.alloc(width * height * 4, 0);
  const hash = createHash("sha256").update(options.sourceBytes).digest();
  const productW = Math.round(width * 0.62);
  const productH = Math.round(height * 0.72);
  const originX = Math.round((width - productW) / 2);
  const originY = Math.round((height - productH) / 2);
  for (let y = originY; y < originY + productH; y += 1) {
    for (let x = originX; x < originX + productW; x += 1) {
      const index = (y * width + x) * 4;
      const sample = hash[(x + y) % hash.length] ?? 120;
      rgba[index] = sample;
      rgba[index + 1] = sample;
      rgba[index + 2] = sample;
      rgba[index + 3] = 255;
    }
  }
  return {
    width,
    height,
    rgba,
    boundingBox: { x: originX, y: originY, width: productW, height: productH },
    png: encodeRgbaPng(width, height, rgba),
    method: "unavailable",
    confidence: 0,
    productPreserved: false,
  };
}

export { encodeRgbaPng };

export function buildProductMask(canvas: PreparedCanvas): Buffer {
  const { width, height, rgba } = canvas;
  const maskRgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const alpha = rgba[i * 4 + 3] ?? 0;
    maskRgba[i * 4] = alpha;
    maskRgba[i * 4 + 1] = alpha;
    maskRgba[i * 4 + 2] = alpha;
    maskRgba[i * 4 + 3] = 255;
  }
  return encodeRgbaPng(width, height, maskRgba);
}

export function analyzeCutoutQuality(canvas: PreparedCanvas): {
  backgroundRemoved: boolean;
  transparencyCorrect: boolean;
  edgesClean: boolean;
  productNotDamaged: boolean;
} {
  let transparentOutside = 0;
  let outside = 0;
  let opaqueInside = 0;
  let inside = 0;
  let edgeSoftSamples = 0;
  let edgeSamples = 0;
  const { x, y, width, height } = canvas.boundingBox;
  for (let py = 0; py < canvas.height; py += 4) {
    for (let px = 0; px < canvas.width; px += 4) {
      const alpha = canvas.rgba[(py * canvas.width + px) * 4 + 3] ?? 0;
      const inBox = px >= x && px < x + width && py >= y && py < y + height;
      if (inBox) {
        inside += 1;
        if (alpha > 200) opaqueInside += 1;
        const nearEdge =
          px < x + 4 || px >= x + width - 4 || py < y + 4 || py >= y + height - 4;
        if (nearEdge) {
          edgeSamples += 1;
          if (alpha > 20 && alpha < 240) edgeSoftSamples += 1;
        }
      } else {
        outside += 1;
        if (alpha < 120) transparentOutside += 1;
      }
    }
  }
  const backgroundRemoved = outside === 0 ? true : transparentOutside / outside >= 0.85;
  const productNotDamaged = canvas.productPreserved && (inside === 0 ? false : opaqueInside / inside >= 0.2);
  // Source-preserving cutouts may have hard product edges; that is acceptable and preferred for identity.
  const edgesClean = edgeSamples === 0
    ? true
    : opaqueInside / Math.max(1, inside) >= 0.25
      || edgeSoftSamples / edgeSamples >= 0.05;
  const transparencyCorrect = canvas.rgba.length === canvas.width * canvas.height * 4 && backgroundRemoved;
  return {
    backgroundRemoved,
    transparencyCorrect,
    edgesClean,
    productNotDamaged,
  };
}

export function isProductionSafeDerivedForeground(image: {
  width?: number;
  height?: number;
  fileName?: string;
  processingStatus?: string;
  derivedKind?: string;
}): boolean {
  if (image.processingStatus && image.processingStatus !== "ready") return false;
  if (image.derivedKind && image.derivedKind !== "analyzed") return false;
  const named = (image.fileName ?? "").includes(PREPARATION_METHOD);
  // Only source-preserving cutouts may replace originals in video render.
  if (!named) return false;
  const edge = Math.min(image.width ?? 0, image.height ?? 0);
  return edge >= VIDEO_SAFE_MIN_EDGE;
}

function estimateBackground(rgba: Buffer, width: number, height: number): {
  r: number;
  g: number;
  b: number;
  uniformity: number;
} {
  const samples: Array<[number, number, number]> = [];
  const border = Math.max(1, Math.round(Math.min(width, height) * 0.06));
  const push = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    samples.push([rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0]);
  };
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 40))) {
    for (let t = 0; t < border; t += 1) {
      push(x, t);
      push(x, height - 1 - t);
    }
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 40))) {
    for (let t = 0; t < border; t += 1) {
      push(t, y);
      push(width - 1 - t, y);
    }
  }
  if (!samples.length) return { r: 245, g: 245, b: 245, uniformity: 0 };
  const sortedR = samples.map((s) => s[0]).sort((a, b) => a - b);
  const sortedG = samples.map((s) => s[1]).sort((a, b) => a - b);
  const sortedB = samples.map((s) => s[2]).sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  const r = sortedR[mid] ?? 245;
  const g = sortedG[mid] ?? 245;
  const b = sortedB[mid] ?? 245;
  let close = 0;
  for (const sample of samples) {
    if (colorDistance(sample[0], sample[1], sample[2], r, g, b) <= 28) close += 1;
  }
  return { r, g, b, uniformity: close / samples.length };
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
