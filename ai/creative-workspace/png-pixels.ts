/**
 * Bounded PNG decode / thumbnail encode.
 * Deterministic pixel access for Image Intelligence — never writes originals.
 */
import { deflateSync, inflateSync } from "node:zlib";

export const MAX_DECODE_BYTES = 8 * 1024 * 1024;
export const MAX_DECODE_PIXELS = 4_000_000;
export const THUMBNAIL_MAX_EDGE = 256;

export interface DecodedPng {
  width: number;
  height: number;
  rgba: Buffer;
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function decodePngRgba(data: Buffer): DecodedPng | null {
  if (data.length < 24 || !startsWith(data, PNG_SIG)) return null;
  if (data.length > MAX_DECODE_BYTES) return null;

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  let palette: Buffer | null = null;
  let transparency: Buffer | null = null;

  let offset = 8;
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    if (offset + 12 + length > data.length) return null;
    const type = data.toString("ascii", offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      if (chunk.length < 13) return null;
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8] ?? 0;
      colorType = chunk[9] ?? 0;
      interlace = chunk[12] ?? 0;
    } else if (type === "PLTE") {
      palette = Buffer.from(chunk);
    } else if (type === "tRNS") {
      transparency = Buffer.from(chunk);
    } else if (type === "IDAT") {
      idat.push(chunk);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  if (!width || !height || interlace !== 0 || bitDepth !== 8) return null;
  if (width * height > MAX_DECODE_PIXELS) return null;
  if (![0, 2, 3, 4, 6].includes(colorType)) return null;
  if (colorType === 3 && (!palette || palette.length < 3)) return null;

  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }

  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : 4;
  const stride = 1 + width * channels;
  if (inflated.length < stride * height) return null;

  const raw = unfilter(inflated, width, height, channels);
  if (!raw) return null;
  return {
    width,
    height,
    rgba: toRgba(raw, width, height, colorType, palette, transparency),
  };
}

export function downsampleRgba(rgba: Buffer, width: number, height: number, maxEdge = THUMBNAIL_MAX_EDGE): DecodedPng {
  const scale = Math.max(width, height) / maxEdge;
  if (scale <= 1) return { width, height, rgba };
  const nextWidth = Math.max(1, Math.round(width / scale));
  const nextHeight = Math.max(1, Math.round(height / scale));
  const next = Buffer.alloc(nextWidth * nextHeight * 4);
  for (let y = 0; y < nextHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(y * scale));
    for (let x = 0; x < nextWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(x * scale));
      const source = (sourceY * width + sourceX) * 4;
      const dest = (y * nextWidth + x) * 4;
      rgba.copy(next, dest, source, source + 4);
    }
  }
  return { width: nextWidth, height: nextHeight, rgba: next };
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

export function buildThumbnailPng(decoded: DecodedPng, maxEdge = THUMBNAIL_MAX_EDGE): { png: Buffer; width: number; height: number } {
  const scaled = downsampleRgba(decoded.rgba, decoded.width, decoded.height, maxEdge);
  return { png: encodeRgbaPng(scaled.width, scaled.height, scaled.rgba), width: scaled.width, height: scaled.height };
}

function startsWith(data: Buffer, sig: Buffer): boolean {
  return data.length >= sig.length && sig.every((byte, i) => data[i] === byte);
}

function unfilter(inflated: Buffer, width: number, height: number, channels: number): Buffer | null {
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  let source = 0;
  let previous: Buffer | null = null;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source] ?? 0;
    source += 1;
    const row = inflated.subarray(source, source + stride);
    if (row.length < stride) return null;
    source += stride;
    const dest = Buffer.alloc(stride);
    for (let i = 0; i < stride; i += 1) {
      const raw = row[i] ?? 0;
      const a = i >= channels ? dest[i - channels]! : 0;
      const b = previous ? previous[i]! : 0;
      const c = previous && i >= channels ? previous[i - channels]! : 0;
      dest[i] = (raw + predictor(filter, a, b, c)) & 0xff;
    }
    dest.copy(out, y * stride);
    previous = dest;
  }
  return out;
}

function predictor(filter: number, a: number, b: number, c: number): number {
  if (filter === 0) return 0;
  if (filter === 1) return a;
  if (filter === 2) return b;
  if (filter === 3) return (a + b) >> 1;
  if (filter === 4) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }
  return 0;
}

function toRgba(
  raw: Buffer,
  width: number,
  height: number,
  colorType: number,
  palette: Buffer | null,
  transparency: Buffer | null,
): Buffer {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const dest = i * 4;
    if (colorType === 0) {
      const gray = raw[i] ?? 0;
      rgba[dest] = gray;
      rgba[dest + 1] = gray;
      rgba[dest + 2] = gray;
      rgba[dest + 3] = 255;
    } else if (colorType === 2) {
      const source = i * 3;
      rgba[dest] = raw[source] ?? 0;
      rgba[dest + 1] = raw[source + 1] ?? 0;
      rgba[dest + 2] = raw[source + 2] ?? 0;
      rgba[dest + 3] = 255;
    } else if (colorType === 3) {
      const index = raw[i] ?? 0;
      rgba[dest] = palette![index * 3] ?? 0;
      rgba[dest + 1] = palette![index * 3 + 1] ?? 0;
      rgba[dest + 2] = palette![index * 3 + 2] ?? 0;
      rgba[dest + 3] = transparency && index < transparency.length ? transparency[index]! : 255;
    } else if (colorType === 4) {
      const source = i * 2;
      const gray = raw[source] ?? 0;
      rgba[dest] = gray;
      rgba[dest + 1] = gray;
      rgba[dest + 2] = gray;
      rgba[dest + 3] = raw[source + 1] ?? 255;
    } else {
      raw.copy(rgba, dest, i * 4, i * 4 + 4);
    }
  }
  return rgba;
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
