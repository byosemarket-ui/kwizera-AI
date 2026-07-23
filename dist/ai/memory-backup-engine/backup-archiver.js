import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BackupSource, BackupType, RetentionTier, } from "./types.js";
export class BackupArchiver {
    foundation;
    storageRoot;
    backupsRoot;
    scanner;
    compressor;
    validator;
    versionStore;
    retentionManager;
    logger;
    constructor(foundation, storageRoot, backupsRoot, scanner, compressor, validator, versionStore, retentionManager, logger) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.backupsRoot = backupsRoot;
        this.scanner = scanner;
        this.compressor = compressor;
        this.validator = validator;
        this.versionStore = versionStore;
        this.retentionManager = retentionManager;
        this.logger = logger;
    }
    async createBackup(backupType, options = {}) {
        const start = Date.now();
        const backupId = `bk-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const version = this.versionStore.getNextVersion();
        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const projectSegment = options.projectId ?? "global";
        const backupDir = path.join(this.backupsRoot, year, month, projectSegment, backupType, `v${version}`);
        const dataDir = path.join(backupDir, "data");
        fs.mkdirSync(dataDir, { recursive: true });
        let scanned = this.scanner.scan(options.sources);
        if (options.sinceTimestamp && backupType === BackupType.Incremental) {
            const since = new Date(options.sinceTimestamp).getTime();
            scanned = scanned.filter((f) => {
                if (!fs.existsSync(f.absolutePath))
                    return false;
                return fs.statSync(f.absolutePath).mtimeMs > since;
            });
        }
        if (scanned.length === 0 && backupType !== BackupType.Incremental) {
            const registryPath = path.join(this.storageRoot, "memory", "registry", "memory-registry.json");
            if (fs.existsSync(registryPath)) {
                scanned = [
                    {
                        source: BackupSource.PersistentMemory,
                        absolutePath: registryPath,
                        relativePath: path.relative(this.storageRoot, registryPath).replace(/\\/g, "/"),
                    },
                ];
            }
        }
        const files = [];
        let totalSize = 0;
        let compressedSize = 0;
        const compress = options.compress ?? true;
        for (const file of scanned) {
            const destPath = path.join(dataDir, file.relativePath);
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(file.absolutePath, destPath);
            let checksumPath = destPath;
            let compressed = false;
            if (compress && fs.statSync(destPath).size > 512) {
                const result = this.compressor.compressFile(destPath);
                fs.unlinkSync(destPath);
                checksumPath = result.compressedPath;
                compressed = true;
                totalSize += result.originalSize;
                compressedSize += result.compressedSize;
            }
            else {
                const size = fs.statSync(destPath).size;
                totalSize += size;
                compressedSize += size;
            }
            const checksum = this.validator.computeChecksum(checksumPath);
            files.push({
                relativePath: file.relativePath,
                source: file.source,
                sizeBytes: fs.statSync(checksumPath).size,
                checksum,
                compressed,
            });
        }
        const relationshipGraph = this.foundation.getRelationshipMemoryEngine().getGraph();
        const recordCount = this.foundation.getStorageEngine().getRecordCount();
        const manifest = {
            backupId,
            version,
            backupType,
            projectId: options.projectId,
            createdAt: now.toISOString(),
            storageRoot: this.storageRoot,
            files,
            totalSizeBytes: totalSize,
            compressedSizeBytes: compressedSize,
            recordCount,
            edgeCount: relationshipGraph.edgeCount,
            validated: false,
            retentionTier: RetentionTier.Latest,
            checksum: "",
        };
        manifest.retentionTier = this.retentionManager.assignRetentionTier(manifest, options.isMilestone);
        const manifestContent = JSON.stringify(manifest, null, 2);
        manifest.checksum = crypto.createHash("sha256").update(manifestContent).digest("hex");
        const finalManifest = { ...manifest, checksum: manifest.checksum };
        fs.writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify(finalManifest, null, 2), "utf8");
        const validation = this.validator.validate(finalManifest, backupDir);
        if (!validation.valid) {
            fs.rmSync(backupDir, { recursive: true, force: true });
            this.logger.log("error", "create", "Backup rejected — validation failed", {
                backupId,
                diagnostics: validation.diagnostics,
            });
            return {
                success: false,
                backupId,
                backupPath: backupDir,
                manifest: finalManifest,
                validation,
                durationMs: Date.now() - start,
            };
        }
        finalManifest.validated = true;
        fs.writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify(finalManifest, null, 2), "utf8");
        fs.writeFileSync(path.join(backupDir, "manifest.sha256"), finalManifest.checksum, "utf8");
        this.versionStore.add(finalManifest);
        this.logger.log("info", "create", "Backup created and validated", {
            backupId,
            backupType,
            files: files.length,
            version,
        });
        return {
            success: true,
            backupId,
            backupPath: backupDir,
            manifest: finalManifest,
            validation,
            durationMs: Date.now() - start,
        };
    }
}
//# sourceMappingURL=backup-archiver.js.map