import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BackupType } from "./types.js";
export function isSafeBackupRelativePath(value) {
    const normalized = value.replace(/\\/g, "/");
    return Boolean(normalized) &&
        !normalized.includes("\0") &&
        !path.isAbsolute(value) &&
        !path.win32.isAbsolute(value) &&
        normalized === path.posix.normalize(normalized) &&
        normalized !== ".." &&
        !normalized.startsWith("../");
}
export class BackupIntegrityValidator {
    foundation;
    logger;
    constructor(foundation, logger) {
        this.foundation = foundation;
        this.logger = logger;
    }
    validate(manifest, backupDir) {
        const diagnostics = [];
        let fileIntegrity = true;
        for (const file of manifest.files) {
            if (!isSafeBackupRelativePath(file.relativePath)) {
                fileIntegrity = false;
                diagnostics.push(`Unsafe backup path: ${file.relativePath}`);
                continue;
            }
            const filePath = file.compressed
                ? path.join(backupDir, "data", `${file.relativePath}.gz`)
                : path.join(backupDir, "data", file.relativePath);
            if (!fs.existsSync(filePath)) {
                fileIntegrity = false;
                diagnostics.push(`Missing backup file: ${file.relativePath}`);
                continue;
            }
            const content = fs.readFileSync(filePath);
            const hash = crypto.createHash("sha256").update(content).digest("hex");
            if (hash !== file.checksum) {
                fileIntegrity = false;
                diagnostics.push(`Checksum mismatch: ${file.relativePath}`);
            }
        }
        const storageIntegrity = this.foundation.getStorageEngine().runIntegrityCheck();
        const memoryIntegrity = storageIntegrity.verified;
        const relationshipIntegrity = this.foundation.getRelationshipMemoryEngine().validateIntegrity().valid;
        const configPath = path.join(manifest.storageRoot, "config");
        const configurationIntegrity = !fs.existsSync(configPath) || fs.statSync(configPath).isDirectory();
        const dbPath = path.join(manifest.storageRoot, "database");
        const databaseIntegrity = !fs.existsSync(dbPath) || fs.statSync(dbPath).isDirectory();
        const completeness = manifest.files.length > 0
            ? fileIntegrity
            : manifest.backupType === BackupType.Incremental;
        const valid = fileIntegrity &&
            memoryIntegrity &&
            relationshipIntegrity &&
            configurationIntegrity &&
            databaseIntegrity &&
            completeness;
        if (!memoryIntegrity)
            diagnostics.push("Memory integrity check failed");
        if (!relationshipIntegrity)
            diagnostics.push("Relationship integrity check failed");
        if (!configurationIntegrity)
            diagnostics.push("Configuration integrity check failed");
        this.logger.log(valid ? "info" : "warn", "validate", "Backup validation complete", {
            valid,
            diagnostics,
        });
        return {
            valid,
            fileIntegrity,
            databaseIntegrity,
            memoryIntegrity,
            relationshipIntegrity,
            configurationIntegrity,
            completeness,
            diagnostics,
        };
    }
    computeChecksum(filePath) {
        const content = fs.readFileSync(filePath);
        return crypto.createHash("sha256").update(content).digest("hex");
    }
}
//# sourceMappingURL=backup-integrity-validator.js.map