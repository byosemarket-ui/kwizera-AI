import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { MemoryBackupLogger } from "./backup-logger.js";

export class BackupCompressor {
  constructor(private readonly logger: MemoryBackupLogger) {}

  compressFile(filePath: string): { compressedPath: string; originalSize: number; compressedSize: number } {
    const originalSize = fs.statSync(filePath).size;
    const content = fs.readFileSync(filePath);
    const compressed = zlib.gzipSync(content);
    const compressedPath = `${filePath}.gz`;
    fs.writeFileSync(compressedPath, compressed);

    this.logger.log("info", "compress", "File compressed", {
      filePath,
      originalSize,
      compressedSize: compressed.length,
    });

    return { compressedPath, originalSize, compressedSize: compressed.length };
  }

  decompressFile(compressedPath: string, targetPath: string): void {
    const content = zlib.gunzipSync(fs.readFileSync(compressedPath));
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content);
  }

  getCompressionRatio(original: number, compressed: number): number {
    if (original === 0) return 100;
    return Math.round((1 - compressed / original) * 100);
  }
}
