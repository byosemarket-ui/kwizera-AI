import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
export class SafetySnapshotManager {
    foundation;
    storageRoot;
    logger;
    snapshotsDir = "";
    constructor(foundation, storageRoot, logger) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
        this.logger = logger;
    }
    initialize(recoveryDir) {
        this.snapshotsDir = path.join(recoveryDir, "safety-snapshots");
        fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }
    async create(label) {
        const snapshotId = `snap-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const result = await this.foundation.getMemoryBackupEngine().createManualBackup();
        const snapshotMeta = {
            snapshotId,
            label,
            backupId: result.backupId,
            createdAt: new Date().toISOString(),
        };
        const metaPath = path.join(this.snapshotsDir, `${snapshotId}.json`);
        fs.writeFileSync(metaPath, JSON.stringify(snapshotMeta, null, 2), "utf8");
        this.logger.log("info", "snapshot", "Safety snapshot created", snapshotMeta);
        return snapshotId;
    }
}
//# sourceMappingURL=safety-snapshot-manager.js.map