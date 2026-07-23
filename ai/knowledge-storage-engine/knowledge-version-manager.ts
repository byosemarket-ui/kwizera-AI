import fs from "node:fs";
import path from "node:path";
import { KnowledgeRecord, KnowledgeStorageVersionEntry } from "./types.js";
import { KnowledgeStorageLogger } from "./storage-logger.js";

export class KnowledgeVersionManager {
  private totalVersions = 0;

  constructor(private readonly logger: KnowledgeStorageLogger) {}

  getVersionsDir(recordStorageLocation: string): string {
    return path.join(recordStorageLocation, "versions");
  }

  saveVersion(record: KnowledgeRecord, recordStorageLocation: string, changeSummary: string): KnowledgeStorageVersionEntry {
    const versionsDir = this.getVersionsDir(recordStorageLocation);
    fs.mkdirSync(versionsDir, { recursive: true });

    const versionPath = path.join(versionsDir, `v${record.version}.json`);
    fs.writeFileSync(versionPath, JSON.stringify(record, null, 2), "utf8");

    const entry: KnowledgeStorageVersionEntry = {
      version: record.version,
      timestamp: record.lastUpdated,
      storagePath: versionPath,
      contentHash: record.contentHash,
      changeSummary,
    };

    this.totalVersions++;
    this.logger.log("info", "version", `Version ${record.version} preserved`, {
      knowledgeId: record.knowledgeId,
      versionPath,
      changeSummary,
    });

    return entry;
  }

  archiveBeforeUpdate(existing: KnowledgeRecord, recordStorageLocation: string): void {
    this.saveVersion(existing, recordStorageLocation, `Archived before update to v${existing.version + 1}`);
  }

  listVersions(recordStorageLocation: string): KnowledgeStorageVersionEntry[] {
    const versionsDir = this.getVersionsDir(recordStorageLocation);
    if (!fs.existsSync(versionsDir)) return [];

    return fs
      .readdirSync(versionsDir)
      .filter((f) => f.startsWith("v") && f.endsWith(".json"))
      .map((f) => {
        const raw = fs.readFileSync(path.join(versionsDir, f), "utf8");
        const record = JSON.parse(raw) as KnowledgeRecord;
        return {
          version: record.version,
          timestamp: record.lastUpdated,
          storagePath: path.join(versionsDir, f),
          contentHash: record.contentHash,
          changeSummary: `Version ${record.version}`,
        };
      })
      .sort((a, b) => a.version - b.version);
  }

  getVersion(recordStorageLocation: string, version: number): KnowledgeRecord | null {
    const versionPath = path.join(this.getVersionsDir(recordStorageLocation), `v${version}.json`);
    if (!fs.existsSync(versionPath)) return null;
    return JSON.parse(fs.readFileSync(versionPath, "utf8")) as KnowledgeRecord;
  }

  getTotalVersions(): number {
    return this.totalVersions;
  }
}
