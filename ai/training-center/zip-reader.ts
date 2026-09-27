/**
 * Phase 18B — minimal, bounded ZIP reader for DOCX/EPUB containers (Node zlib only).
 * Reads the central directory, inflates only requested entries, and refuses zip bombs, encrypted entries,
 * unsupported compression and absurd entry counts. Entry names are never used as filesystem paths.
 */
import { inflateRawSync } from "node:zlib";

export class ZipError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ZipError";
  }
}

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  localOffset: number;
  encrypted: boolean;
}

const MAX_ENTRIES = 5_000;
const MAX_ENTRY_BYTES = 30 * 1024 * 1024;
const MAX_TOTAL_BYTES = 120 * 1024 * 1024;
const MAX_RATIO = 200;

export class ZipArchive {
  readonly entries: ZipEntry[];
  private inflatedTotal = 0;

  constructor(private readonly buf: Buffer) {
    this.entries = this.readDirectory();
  }

  private readDirectory(): ZipEntry[] {
    const buf = this.buf;
    if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) throw new ZipError("NOT_A_ZIP", "The file is not a valid ZIP-based document.");
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i -= 1) {
      if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new ZipError("CORRUPT_ZIP", "The document container is damaged (no central directory).");
    const count = buf.readUInt16LE(eocd + 10);
    const dirSize = buf.readUInt32LE(eocd + 12);
    const dirOffset = buf.readUInt32LE(eocd + 16);
    if (count > MAX_ENTRIES) throw new ZipError("TOO_MANY_ENTRIES", "The document container has too many entries.");
    if (dirOffset + dirSize > buf.length) throw new ZipError("CORRUPT_ZIP", "The document container is damaged.");
    const entries: ZipEntry[] = [];
    let p = dirOffset;
    for (let i = 0; i < count; i += 1) {
      if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new ZipError("CORRUPT_ZIP", "The document container is damaged.");
      const flags = buf.readUInt16LE(p + 8);
      const method = buf.readUInt16LE(p + 10);
      const compressedSize = buf.readUInt32LE(p + 20);
      const size = buf.readUInt32LE(p + 24);
      const nameLen = buf.readUInt16LE(p + 28);
      const extraLen = buf.readUInt16LE(p + 30);
      const commentLen = buf.readUInt16LE(p + 32);
      const localOffset = buf.readUInt32LE(p + 42);
      const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
      entries.push({ name, method, compressedSize, size, localOffset, encrypted: (flags & 1) === 1 });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  find(name: string): ZipEntry | undefined {
    const wanted = name.replace(/^\/+/, "");
    return this.entries.find((e) => e.name === wanted) ?? this.entries.find((e) => e.name.toLowerCase() === wanted.toLowerCase());
  }

  read(entry: ZipEntry): Buffer {
    if (entry.encrypted) throw new ZipError("ENCRYPTED", "The document is encrypted.");
    if (entry.size > MAX_ENTRY_BYTES) throw new ZipError("ENTRY_TOO_LARGE", "A part of the document is too large.");
    if (entry.compressedSize > 0 && entry.size / entry.compressedSize > MAX_RATIO) throw new ZipError("SUSPICIOUS_COMPRESSION", "The document has a suspicious compression ratio.");
    const buf = this.buf;
    const p = entry.localOffset;
    if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) throw new ZipError("CORRUPT_ZIP", "The document container is damaged.");
    const start = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
    const raw = buf.subarray(start, start + entry.compressedSize);
    let out: Buffer;
    if (entry.method === 0) out = Buffer.from(raw);
    else if (entry.method === 8) out = inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES });
    else throw new ZipError("UNSUPPORTED_COMPRESSION", "The document uses an unsupported compression method.");
    this.inflatedTotal += out.length;
    if (this.inflatedTotal > MAX_TOTAL_BYTES) throw new ZipError("TOO_LARGE", "The document expands to more than the allowed size.");
    return out;
  }

  readText(name: string): string | null {
    const entry = this.find(name);
    return entry ? this.read(entry).toString("utf8") : null;
  }
}
