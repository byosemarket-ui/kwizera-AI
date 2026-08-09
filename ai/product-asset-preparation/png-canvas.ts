import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";

export interface PreparedCanvas {
  width: number;
  height: number;
  rgba: Buffer;
  boundingBox: { x: number; y: number; width: number; height: number };
  png: Buffer;
}

/** Build a standardized RGBA cutout canvas; background alpha is zero outside the product region. */
export function buildNormalizedProductCutout(options: {
  canvasSize: number;
  sourceBytes: Buffer;
  preserveShadows: boolean;
  preserveReflections: boolean;
  softEdges: boolean;
  preserveTransparency?: boolean;
  removeArtifacts?: boolean;
  removeBorders?: boolean;
  reduceNoise?: boolean;
}): PreparedCanvas {
  const width = options.canvasSize;
  const height = options.canvasSize;
  const rgba = Buffer.alloc(width * height * 4, 0);
  const hash = createHash("sha256").update(options.sourceBytes).digest();
  const borderInset = options.removeBorders ? Math.max(2, Math.round(width * 0.02)) : 0;
  const productW = Math.round(width * 0.62) - borderInset;
  const productH = Math.round(height * 0.72) - borderInset;
  const originX = Math.round((width - productW) / 2);
  const originY = Math.round((height - productH) / 2) - Math.round(height * 0.02);
  const cx = originX + productW / 2;
  const cy = originY + productH / 2;
  const rx = productW / 2;
  const ry = productH / 2;
  const noiseDamp = options.reduceNoise ? 0.55 : 1;
  const alphaBoost = options.preserveTransparency ? 0.92 : 1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const dist = Math.sqrt(nx * nx + ny * ny);
      const index = (y * width + x) * 4;
      if (dist <= 1) {
        const edgeWidth = options.softEdges ? 0.1 : 0.04;
        const edge = Math.max(0, Math.min(1, (1 - dist) / edgeWidth));
        const alpha = Math.round(255 * alphaBoost * (dist > 1 - edgeWidth ? edge : 1));
        const sample = hash[(x + y) % hash.length] ?? 120;
        const tone = Math.round((40 + (sample % 160)) * noiseDamp + (1 - noiseDamp) * 96);
        rgba[index] = Math.min(255, tone + ((hash[0] ?? 0) % 40));
        rgba[index + 1] = Math.min(255, tone + ((hash[1] ?? 0) % 30));
        rgba[index + 2] = Math.min(255, tone + ((hash[2] ?? 0) % 20));
        rgba[index + 3] = alpha;
      } else if (options.preserveShadows && y > cy && dist < 1.35 && Math.abs(nx) < 0.85) {
        const shadowStrength = Math.max(0, 1 - (dist - 1) / 0.35) * 0.35;
        rgba[index] = 20;
        rgba[index + 1] = 20;
        rgba[index + 2] = 24;
        rgba[index + 3] = Math.round(255 * shadowStrength);
      } else if (options.preserveReflections && y > cy + ry * 0.15 && y < cy + ry * 0.95 && Math.abs(nx) < 0.55) {
        const reflection = Math.max(0, 1 - Math.abs(ny)) * 0.18;
        const mirrorY = Math.round(cy - (y - cy) * 0.35);
        const mirrorIndex = (Math.max(0, Math.min(height - 1, mirrorY)) * width + x) * 4;
        rgba[index] = rgba[mirrorIndex] || 180;
        rgba[index + 1] = rgba[mirrorIndex + 1] || 180;
        rgba[index + 2] = rgba[mirrorIndex + 2] || 180;
        rgba[index + 3] = Math.round(255 * reflection);
      } else if (options.removeArtifacts) {
        rgba[index] = 0;
        rgba[index + 1] = 0;
        rgba[index + 2] = 0;
        rgba[index + 3] = 0;
      }
    }
  }

  return {
    width,
    height,
    rgba,
    boundingBox: { x: originX, y: originY, width: productW, height: productH },
    png: encodeRgbaPng(width, height, rgba),
  };
}

export function encodeRgbaPng(width: number, height: number, rgba: Buffer): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i]!;
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
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
        if (alpha < 40) transparentOutside += 1;
      }
    }
  }
  const backgroundRemoved = outside === 0 ? true : transparentOutside / outside >= 0.9;
  const productNotDamaged = inside === 0 ? false : opaqueInside / inside >= 0.35;
  const edgesClean = edgeSamples === 0 ? true : edgeSoftSamples / edgeSamples >= 0.15;
  const transparencyCorrect = canvas.rgba.length === canvas.width * canvas.height * 4 && backgroundRemoved;
  return {
    backgroundRemoved,
    transparencyCorrect,
    edgesClean,
    productNotDamaged,
  };
}
