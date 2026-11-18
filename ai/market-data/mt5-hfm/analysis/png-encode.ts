/**
 * Minimal RGBA → PNG encoder (Node zlib only — no Chromium / canvas deps).
 */
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Encode raw RGBA (width*height*4) into a PNG buffer. */
export function encodeRgbaPng(width: number, height: number, rgba: Buffer): Buffer {
  if (width < 1 || height < 1) throw new Error("Invalid PNG dimensions");
  if (rgba.length < width * height * 4) throw new Error("RGBA buffer too small");

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter none
    rgba.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }
  const compressed = deflateSync(raw, { level: 6 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function isValidPngBuffer(buf: Buffer): boolean {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return false;
  return (
    buf[0] === 137 &&
    buf[1] === 80 &&
    buf[2] === 78 &&
    buf[3] === 71 &&
    buf[4] === 13 &&
    buf[5] === 10 &&
    buf[6] === 26 &&
    buf[7] === 10
  );
}
