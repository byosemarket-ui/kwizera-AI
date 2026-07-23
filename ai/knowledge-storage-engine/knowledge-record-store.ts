import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { KNOWLEDGE_STORAGE_TYPE_DEFINITIONS } from "./storage-type-config.js";
import { KnowledgeStorageLogger } from "./storage-logger.js";

export class KnowledgeRecordStore {
  private recordsRoot = "";
  private storageDir = "";

  constructor(private readonly logger: KnowledgeStorageLogger) {}

  initialize(knowledgeRoot: string): void {
    this.recordsRoot = path.join(knowledgeRoot, "records");
    this.storageDir = path.join(knowledgeRoot, "storage");

    const dirs = [
      this.recordsRoot,
      this.storageDir,
      ...KNOWLEDGE_STORAGE_TYPE_DEFINITIONS.map((t) => path.join(this.recordsRoot, t.subdirectory)),
    ];

    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.logger.log("info", "startup", "Knowledge record store directories initialized", {
      recordsRoot: this.recordsRoot,
      typeCount: KNOWLEDGE_STORAGE_TYPE_DEFINITIONS.length,
    });
  }

  getRecordsRoot(): string {
    return this.recordsRoot;
  }

  getStorageDir(): string {
    return this.storageDir;
  }

  getRecordPath(knowledgeType: string, knowledgeId: string): string {
    const def = KNOWLEDGE_STORAGE_TYPE_DEFINITIONS.find((d) => d.type === knowledgeType);
    const subdir = def?.subdirectory ?? "technical";
    return path.join(this.recordsRoot, subdir, knowledgeId);
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
