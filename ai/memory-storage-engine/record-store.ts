import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { STORAGE_TYPE_DEFINITIONS } from "./storage-type-config.js";
import { MemoryStorageLogger } from "./storage-logger.js";

export class RecordStore {
  private recordsRoot = "";
  private storageDir = "";

  constructor(private readonly logger: MemoryStorageLogger) {}

  initialize(memoryRoot: string): void {
    this.recordsRoot = path.join(memoryRoot, "records");
    this.storageDir = path.join(memoryRoot, "storage");

    const dirs = [
      this.recordsRoot,
      this.storageDir,
      ...STORAGE_TYPE_DEFINITIONS.map((t) => path.join(this.recordsRoot, t.subdirectory)),
    ];

    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.logger.log("info", "startup", "Record store directories initialized", {
      recordsRoot: this.recordsRoot,
      typeCount: STORAGE_TYPE_DEFINITIONS.length,
    });
  }

  getRecordsRoot(): string {
    return this.recordsRoot;
  }

  getStorageDir(): string {
    return this.storageDir;
  }

  getRecordPath(memoryType: string, memoryId: string): string {
    const def = STORAGE_TYPE_DEFINITIONS.find((d) => d.type === memoryType);
    const subdir = def?.subdirectory ?? "system";
    return path.join(this.recordsRoot, subdir, memoryId);
  }

  isStorageAvailable(): boolean {
    try {
      const testFile = path.join(this.storageDir, ".write-test");
      fs.writeFileSync(testFile, "ok", "utf8");
      fs.unlinkSync(testFile);
      return fs.existsSync(this.recordsRoot);
    } catch {
      return false;
    }
  }

  writeRecord(recordPath: string, record: unknown): number {
    const start = Date.now();
    fs.mkdirSync(recordPath, { recursive: true });
    const currentPath = path.join(recordPath, "current.json");
    const content = JSON.stringify(record, null, 2);
    fs.writeFileSync(currentPath, content, "utf8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    fs.writeFileSync(`${currentPath}.sha256`, hash, "utf8");
    return Date.now() - start;
  }

  readRecord<T>(recordPath: string): { data: T | null; durationMs: number } {
    const start = Date.now();
    const currentPath = path.join(recordPath, "current.json");
    if (!fs.existsSync(currentPath)) {
      return { data: null, durationMs: Date.now() - start };
    }
    const raw = fs.readFileSync(currentPath, "utf8");
    return { data: JSON.parse(raw) as T, durationMs: Date.now() - start };
  }

  verifyRecordChecksum(recordPath: string): boolean {
    const currentPath = path.join(recordPath, "current.json");
    const checksumPath = `${currentPath}.sha256`;
    if (!fs.existsSync(currentPath) || !fs.existsSync(checksumPath)) {
      return false;
    }
    const content = fs.readFileSync(currentPath, "utf8");
    const expected = fs.readFileSync(checksumPath, "utf8").trim();
    const actual = crypto.createHash("sha256").update(content).digest("hex");
    return expected === actual;
  }
}
