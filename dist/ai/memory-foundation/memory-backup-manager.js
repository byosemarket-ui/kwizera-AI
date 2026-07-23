import fs from "node:fs";
import path from "node:path";
export class MemoryBackupManager {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    createBackup(storage, label) {
        const start = Date.now();
        const backupsDir = storage.getBackupsDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = path.join(backupsDir, `${label}-${timestamp}.json`);
        const manifest = {
            label,
            memoryRoot: storage.getMemoryRoot(),
            registryPath: storage.getRegistryPath(),
            createdAt: new Date().toISOString(),
        };
        fs.writeFileSync(backupPath, JSON.stringify(manifest, null, 2), "utf8");
        const durationMs = Date.now() - start;
        this.logger.log("info", "backup", "Memory backup created", { backupPath, durationMs });
        return { backupPath, durationMs };
    }
    listBackups(storage) {
        const backupsDir = storage.getBackupsDir();
        if (!fs.existsSync(backupsDir))
            return [];
        return fs.readdirSync(backupsDir).filter((f) => f.endsWith(".json"));
    }
}
//# sourceMappingURL=memory-backup-manager.js.map