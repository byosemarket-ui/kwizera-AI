import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
export class BackupCompressor {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    compressFile(filePath) {
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
    decompressFile(compressedPath, targetPath) {
        const content = zlib.gunzipSync(fs.readFileSync(compressedPath));
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, content);
    }
    getCompressionRatio(original, compressed) {
        if (original === 0)
            return 100;
        return Math.round((1 - compressed / original) * 100);
    }
}
//# sourceMappingURL=backup-compressor.js.map