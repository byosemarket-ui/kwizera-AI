import fs from "node:fs";
import path from "node:path";
export class BackupVersionStore {
    registryPath = "";
    manifests = [];
    initialize(backupsRoot) {
        this.registryPath = path.join(backupsRoot, "backup-registry.json");
        if (fs.existsSync(this.registryPath)) {
            this.manifests = JSON.parse(fs.readFileSync(this.registryPath, "utf8"));
        }
    }
    getNextVersion() {
        if (this.manifests.length === 0)
            return 1;
        return Math.max(...this.manifests.map((m) => m.version)) + 1;
    }
    add(manifest) {
        this.manifests.push(manifest);
        this.persist();
    }
    getAll() {
        return [...this.manifests].sort((a, b) => b.version - a.version);
    }
    getById(backupId) {
        return this.manifests.find((m) => m.backupId === backupId);
    }
    getLatest() {
        return this.getAll()[0];
    }
    getRegistryPath() {
        return this.registryPath;
    }
    persist() {
        fs.mkdirSync(path.dirname(this.registryPath), { recursive: true });
        fs.writeFileSync(this.registryPath, JSON.stringify(this.manifests, null, 2), "utf8");
    }
}
//# sourceMappingURL=backup-version-store.js.map