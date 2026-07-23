import fs from "node:fs";
import path from "node:path";
import { MemoryFoundationLogger } from "./memory-logger.js";
import { MemoryStorageManager } from "./memory-storage.js";

export class MemoryBackupManager {
  constructor(private readonly logger: MemoryFoundationLogger) {}

  createBackup(storage: MemoryStorageManager, label: string): { backupPath: string; durationMs: number } {
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

  listBackups(storage: MemoryStorageManager): string[] {
    const backupsDir = storage.getBackupsDir();
    if (!fs.existsSync(backupsDir)) return [];
    return fs.readdirSync(backupsDir).filter((f) => f.endsWith(".json"));
  }
}
