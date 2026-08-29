/**
 * Server-side image integrity checks. Does not rewrite bytes.
 * Used before Creative Workspace stores an original upload.
 */

export type ImageInspectFailure = {
  ok: false;
  code: "INVALID_IMAGE" | "UNSUPPORTED_FORMAT" | "MIME_MISMATCH";
  message: string;
};

export type ImageInspectSuccess = {
  ok: true;
  mimeType: string;
  width?: number;
  height?: number;
};

export type ImageInspectResult = ImageInspectSuccess | ImageInspectFailure;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const BMP = Buffer.from([0x42, 0x4d]);
const TIFF_LE = Buffer.from([0x49, 0x49, 0x2a, 0x00]);
const TIFF_BE = Buffer.from([0x4d, 0x4d, 0x00, 0x2a]);

function startsWith(data: Buffer, sig: Buffer): boolean {
  return data.length >= sig.length && sig.every((byte, i) => data[i] === byte);
}

function pngDimensions(data: Buffer): { width: number; height: number } | undefined {
  if (data.length < 24) return undefined;
  if (data.toString("ascii", 12, 16) !== "IHDR") return undefined;
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (!width || !height || width > 80_000 || height > 80_000) return undefined;
  return { width, height };
}

function jpegDimensions(data: Buffer): { width: number; height: number } | undefined {
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const size = data.readUInt16BE(offset + 2);
    if (size < 2) return undefined;
    if (marker >= 0xc0 && marker <= 0xc3 && offset + 8 < data.length) {
      const height = data.readUInt16BE(offset + 5);
      const width = data.readUInt16BE(offset + 7);
      if (width && height) return { width, height };
    }
    offset += 2 + size;
  }
  return undefined;
}

function webpMime(data: Buffer): boolean {
  return data.length >= 12
    && data.toString("ascii", 0, 4) === "RIFF"
    && data.toString("ascii", 8, 12) === "WEBP";
}

function detectedMime(data: Buffer): string | null {
  if (startsWith(data, JPEG)) return "image/jpeg";
  if (startsWith(data, PNG)) return "image/png";
  if (webpMime(data)) return "image/webp";
  if (startsWith(data, TIFF_LE) || startsWith(data, TIFF_BE)) return "image/tiff";
  if (startsWith(data, BMP)) return "image/bmp";
  return null;
}

function claimedMatches(detected: string, claimed: string): boolean {
  const claim = claimed === "image/x-ms-bmp" ? "image/bmp" : claimed;
  return detected === claim;
}

export function inspectImageBuffer(data: Buffer, claimedMime: string): ImageInspectResult {
  if (!data.length) {
    return { ok: false, code: "INVALID_IMAGE", message: "Image data is empty." };
  }
  const detected = detectedMime(data);
  if (!detected) {
    return { ok: false, code: "INVALID_IMAGE", message: "File is not a readable JPEG, PNG, WEBP, TIFF, or BMP image." };
  }
  const normalizedClaim = claimedMime === "image/x-ms-bmp" ? "image/bmp" : claimedMime;
  if (normalizedClaim && !claimedMatches(detected, normalizedClaim)) {
    return {
      ok: false,
      code: "MIME_MISMATCH",
      message: `Declared type ${normalizedClaim} does not match the file contents (${detected}).`,
    };
  }
  let size: { width: number; height: number } | undefined;
  if (detected === "image/png") size = pngDimensions(data);
  if (detected === "image/jpeg") size = jpegDimensions(data);
  if (detected === "image/png" && !size) {
    return { ok: false, code: "INVALID_IMAGE", message: "PNG file is truncated or unreadable." };
  }
  return {
    ok: true,
    mimeType: detected,
    width: size?.width,
    height: size?.height,
  };
}
