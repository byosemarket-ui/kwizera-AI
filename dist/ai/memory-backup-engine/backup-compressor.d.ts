import { MemoryBackupLogger } from "./backup-logger.js";
export declare class BackupCompressor {
    private readonly logger;
    constructor(logger: MemoryBackupLogger);
    compressFile(filePath: string): {
        compressedPath: string;
        originalSize: number;
        compressedSize: number;
    };
    decompressFile(compressedPath: string, targetPath: string): void;
    getCompressionRatio(original: number, compressed: number): number;
}
//# sourceMappingURL=backup-compressor.d.ts.map