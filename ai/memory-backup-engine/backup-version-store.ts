import fs from "node:fs";
import path from "node:path";
import { BackupManifest } from "./types.js";

export class BackupVersionStore {
  private registryPath = "";
  private manifests: BackupManifest[] = [];

  initialize(backupsRoot: string): void {
    this.registryPath = path.join(backupsRoot, "backup-registry.json");
    if (fs.existsSync(this.registryPath)) {
      this.manifests = JSON.parse(fs.readFileSync(this.registryPath, "utf8")) as BackupManifest[];
    }
  }

  getNextVersion(): number {
    if (this.manifests.length === 0) return 1;
    return Math.max(...this.manifests.map((m) => m.version)) + 1;
  }

  add(manifest: BackupManifest): void {
    this.manifests.push(manifest);
    this.persist();
  }

  getAll(): BackupManifest[] {
    return [...this.manifests].sort((a, b) => b.version - a.version);
  }

  getById(backupId: string): BackupManifest | undefined {
    return this.manifests.find((m) => m.backupId === backupId);
  }

  getLatest(): BackupManifest | undefined {
    return this.getAll()[0];
  }

  getRegistryPath(): string {
    return this.registryPath;
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.registryPath), { recursive: true });
    fs.writeFileSync(this.registryPath, JSON.stringify(this.manifests, null, 2), "utf8");
  }
}
