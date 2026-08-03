import fs from "node:fs";
import path from "node:path";
import { isSafeBackupRelativePath } from "./backup-integrity-validator.js";
import { RestoreMode } from "./types.js";
export class BackupRestorer {
    storageRoot;
    backupsRoot;
    versionStore;
    validator;
    compressor;
    logger;
    constructor(storageRoot, backupsRoot, versionStore, validator, compressor, logger) {
        this.storageRoot = storageRoot;
        this.backupsRoot = backupsRoot;
        this.versionStore = versionStore;
        this.validator = validator;
        this.compressor = compressor;
        this.logger = logger;
    }
    findBackupDir(backupId) {
        const manifest = this.versionStore.getById(backupId);
        if (!manifest)
            return null;
        const walk = (dir) => {
            if (!fs.existsSync(dir))
                return null;
            const manifestPath = path.join(dir, "manifest.json");
            if (fs.existsSync(manifestPath)) {
                const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
                if (m.backupId === backupId)
                    return dir;
            }
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.isDirectory()) {
                    const found = walk(path.join(dir, entry.name));
                    if (found)
                        return found;
                }
            }
            return null;
        };
        return walk(this.backupsRoot);
    }
    async restore(backupId, mode = RestoreMode.Full, pathPrefixes) {
        const start = Date.now();
        const diagnostics = [];
        const manifest = this.versionStore.getById(backupId);
        if (!manifest) {
            return {
                success: false,
                mode,
                backupId,
                filesRestored: 0,
                durationMs: Date.now() - start,
                diagnostics: ["Backup not found in registry"],
            };
        }
        const backupDir = this.findBackupDir(backupId);
        if (!backupDir) {
            return {
                success: false,
                mode,
                backupId,
                filesRestored: 0,
                durationMs: Date.now() - start,
                diagnostics: ["Backup directory not found"],
            };
        }
        const validation = this.validator.validate(manifest, backupDir);
        if (!validation.valid) {
            return {
                success: false,
                mode,
                backupId,
                filesRestored: 0,
                durationMs: Date.now() - start,
                diagnostics: validation.diagnostics,
            };
        }
        let filesToRestore = manifest.files;
        if (mode === RestoreMode.Configuration) {
            filesToRestore = manifest.files.filter((f) => f.relativePath.startsWith("config"));
        }
        else if (mode === RestoreMode.Database) {
            filesToRestore = manifest.files.filter((f) => f.relativePath.startsWith("database"));
        }
        else if (mode === RestoreMode.Memory) {
            filesToRestore = manifest.files.filter((f) => f.relativePath.startsWith("memory"));
        }
        else if (mode === RestoreMode.Project && manifest.projectId) {
            filesToRestore = manifest.files.filter((f) => f.relativePath.includes(manifest.projectId) || f.relativePath.startsWith("projects"));
        }
        else if (pathPrefixes && pathPrefixes.length > 0) {
            filesToRestore = manifest.files.filter((f) => pathPrefixes.some((prefix) => f.relativePath.startsWith(prefix.replace(/\\/g, "/"))));
        }
        let filesRestored = 0;
        for (const file of filesToRestore) {
            if (!isSafeBackupRelativePath(file.relativePath)) {
                diagnostics.push(`Unsafe backup path: ${file.relativePath}`);
                continue;
            }
            const sourcePath = file.compressed
                ? path.join(backupDir, "data", `${file.relativePath}.gz`)
                : path.join(backupDir, "data", file.relativePath);
            const targetPath = path.join(this.storageRoot, file.relativePath);
            if (!fs.existsSync(sourcePath)) {
                diagnostics.push(`Missing: ${file.relativePath}`);
                continue;
            }
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            if (file.compressed) {
                this.compressor.decompressFile(sourcePath, targetPath);
            }
            else {
                fs.copyFileSync(sourcePath, targetPath);
            }
            filesRestored++;
        }
        this.logger.log("info", "restore", "Backup restore complete", {
            backupId,
            mode,
            filesRestored,
        });
        return {
            success: filesRestored > 0 || filesToRestore.length === 0,
            mode,
            backupId,
            filesRestored,
            durationMs: Date.now() - start,
            diagnostics,
        };
    }
}
//# sourceMappingURL=backup-restorer.js.map