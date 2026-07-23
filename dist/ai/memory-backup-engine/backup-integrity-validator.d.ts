import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryBackupLogger } from "./backup-logger.js";
import { BackupManifest, MemoryBackupValidationResult } from "./types.js";
export declare class BackupIntegrityValidator {
    private readonly foundation;
    private readonly logger;
    constructor(foundation: AiMemoryFoundation, logger: MemoryBackupLogger);
    validate(manifest: BackupManifest, backupDir: string): MemoryBackupValidationResult;
    computeChecksum(filePath: string): string;
}
//# sourceMappingURL=backup-integrity-validator.d.ts.map