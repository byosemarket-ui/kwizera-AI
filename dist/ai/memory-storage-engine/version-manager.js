import fs from "node:fs";
import path from "node:path";
export class VersionManager {
    logger;
    totalVersions = 0;
    constructor(logger) {
        this.logger = logger;
    }
    getRecordDir(recordStorageLocation) {
        return recordStorageLocation;
    }
    getVersionsDir(recordStorageLocation) {
        return path.join(recordStorageLocation, "versions");
    }
    getCurrentPath(recordStorageLocation) {
        return path.join(recordStorageLocation, "current.json");
    }
    saveVersion(record, recordStorageLocation) {
        const versionsDir = this.getVersionsDir(recordStorageLocation);
        fs.mkdirSync(versionsDir, { recursive: true });
        const versionPath = path.join(versionsDir, `v${record.version}.json`);
        fs.writeFileSync(versionPath, JSON.stringify(record, null, 2), "utf8");
        const entry = {
            version: record.version,
            timestamp: record.lastUpdate,
            storagePath: versionPath,
            contentHash: record.contentHash,
        };
        this.totalVersions++;
        this.logger.log("info", "version", `Version ${record.version} preserved`, {
            memoryId: record.memoryId,
            versionPath,
        });
        return entry;
    }
    archiveBeforeUpdate(existing, recordStorageLocation) {
        this.saveVersion(existing, recordStorageLocation);
    }
    listVersions(recordStorageLocation) {
        const versionsDir = this.getVersionsDir(recordStorageLocation);
        if (!fs.existsSync(versionsDir))
            return [];
        return fs
            .readdirSync(versionsDir)
            .filter((f) => f.startsWith("v") && f.endsWith(".json"))
            .map((f) => {
            const raw = fs.readFileSync(path.join(versionsDir, f), "utf8");
            const record = JSON.parse(raw);
            return {
                version: record.version,
                timestamp: record.lastUpdate,
                storagePath: path.join(versionsDir, f),
                contentHash: record.contentHash,
            };
        })
            .sort((a, b) => a.version - b.version);
    }
    getVersion(recordStorageLocation, version) {
        const versionPath = path.join(this.getVersionsDir(recordStorageLocation), `v${version}.json`);
        if (!fs.existsSync(versionPath))
            return null;
        return JSON.parse(fs.readFileSync(versionPath, "utf8"));
    }
    getTotalVersions() {
        return this.totalVersions;
    }
}
//# sourceMappingURL=version-manager.js.map