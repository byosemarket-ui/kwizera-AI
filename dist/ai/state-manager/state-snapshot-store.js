import fs from "node:fs";
import path from "node:path";
export class StateSnapshotStore {
    logger;
    stateDirectory = null;
    snapshotsDirectory = null;
    currentStatePath = null;
    snapshots = [];
    diskWrites = 0;
    constructor(logger) {
        this.logger = logger;
    }
    initialize(stateDirectory) {
        fs.mkdirSync(stateDirectory, { recursive: true });
        this.stateDirectory = stateDirectory;
        this.snapshotsDirectory = path.join(stateDirectory, "snapshots");
        this.currentStatePath = path.join(stateDirectory, "current-state.json");
        fs.mkdirSync(this.snapshotsDirectory, { recursive: true });
    }
    saveSnapshot(snapshot) {
        if (!this.snapshotsDirectory || !this.currentStatePath) {
            return;
        }
        const filePath = path.join(this.snapshotsDirectory, `${snapshot.snapshotId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
        const updateCurrent = snapshot.cleanShutdown ||
            snapshot.reason.startsWith("application-") ||
            snapshot.reason === "recovery-complete" ||
            snapshot.reason === "auto-save";
        if (updateCurrent) {
            fs.writeFileSync(this.currentStatePath, JSON.stringify(snapshot, null, 2), "utf8");
            this.diskWrites += 1;
        }
        this.snapshots.push(snapshot);
        this.diskWrites += 1;
        this.logger.log("info", "snapshot", `Snapshot saved: ${snapshot.snapshotId}`, {
            reason: snapshot.reason,
            cleanShutdown: snapshot.cleanShutdown,
        });
    }
    loadLatestSnapshot() {
        if (!this.currentStatePath || !fs.existsSync(this.currentStatePath)) {
            return null;
        }
        try {
            const raw = fs.readFileSync(this.currentStatePath, "utf8");
            const snapshot = JSON.parse(raw);
            return snapshot;
        }
        catch {
            return this.loadLatestFromSnapshotsDirectory();
        }
    }
    loadLatestFromSnapshotsDirectory() {
        if (!this.snapshotsDirectory || !fs.existsSync(this.snapshotsDirectory)) {
            return null;
        }
        const files = fs
            .readdirSync(this.snapshotsDirectory)
            .filter((f) => f.endsWith(".json"))
            .sort()
            .reverse();
        for (const file of files) {
            try {
                const raw = fs.readFileSync(path.join(this.snapshotsDirectory, file), "utf8");
                return JSON.parse(raw);
            }
            catch {
                continue;
            }
        }
        return null;
    }
    getSnapshots() {
        return this.snapshots;
    }
    getSnapshotCount() {
        return this.snapshots.length;
    }
    getDiskWrites() {
        return this.diskWrites;
    }
    getStateDirectory() {
        return this.stateDirectory;
    }
    persistCurrentState(state, cleanShutdown) {
        if (!this.currentStatePath)
            return;
        const snapshot = {
            snapshotId: `current-${Date.now()}`,
            timestamp: new Date().toISOString(),
            reason: "auto-save",
            cleanShutdown,
            state,
        };
        fs.writeFileSync(this.currentStatePath, JSON.stringify(snapshot, null, 2), "utf8");
        this.diskWrites += 1;
    }
}
//# sourceMappingURL=state-snapshot-store.js.map