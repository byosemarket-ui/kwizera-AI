import fs from "node:fs";
import path from "node:path";
import { MemoryRecord, MemoryVersionEntry } from "./types.js";
import { MemoryStorageLogger } from "./storage-logger.js";

export class VersionManager {
  private totalVersions = 0;

  constructor(private readonly logger: MemoryStorageLogger) {}

  getRecordDir(recordStorageLocation: string): string {
    return recordStorageLocation;
  }

  getVersionsDir(recordStorageLocation: string): string {
    return path.join(recordStorageLocation, "versions");
  }

  getCurrentPath(recordStorageLocation: string): string {
    return path.join(recordStorageLocation, "current.json");
  }

  saveVersion(record: MemoryRecord, recordStorageLocation: string): MemoryVersionEntry {
    const versionsDir = this.getVersionsDir(recordStorageLocation);
    fs.mkdirSync(versionsDir, { recursive: true });

    const versionPath = path.join(versionsDir, `v${record.version}.json`);
    fs.writeFileSync(versionPath, JSON.stringify(record, null, 2), "utf8");

    const entry: MemoryVersionEntry = {
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

  archiveBeforeUpdate(existing: MemoryRecord, recordStorageLocation: string): void {
    this.saveVersion(existing, recordStorageLocation);
  }

  listVersions(recordStorageLocation: string): MemoryVersionEntry[] {
    const versionsDir = this.getVersionsDir(recordStorageLocation);
    if (!fs.existsSync(versionsDir)) return [];

    return fs
      .readdirSync(versionsDir)
      .filter((f) => f.startsWith("v") && f.endsWith(".json"))
      .map((f) => {
        const raw = fs.readFileSync(path.join(versionsDir, f), "utf8");
        const record = JSON.parse(raw) as MemoryRecord;
        return {
          version: record.version,
          timestamp: record.lastUpdate,
          storagePath: path.join(versionsDir, f),
          contentHash: record.contentHash,
        };
      })
      .sort((a, b) => a.version - b.version);
  }

  getVersion(recordStorageLocation: string, version: number): MemoryRecord | null {
    const versionPath = path.join(this.getVersionsDir(recordStorageLocation), `v${version}.json`);
    if (!fs.existsSync(versionPath)) return null;
    return JSON.parse(fs.readFileSync(versionPath, "utf8")) as MemoryRecord;
  }

  getTotalVersions(): number {
    return this.totalVersions;
  }
}
