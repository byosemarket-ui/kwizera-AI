import fs from "node:fs";
import path from "node:path";
import { resolveStoragePath } from "../../storage/paths/storage-paths.js";
import { PREPARED_MEMORY_CATEGORIES, PROTECTED_DATA_CATEGORIES } from "./memory-categories.js";
import { MemoryFoundationLogger } from "./memory-logger.js";

export class MemoryStorageManager {
  private memoryRoot = "";
  private registryDir = "";
  private backupsDir = "";
  private protectedDir = "";

  constructor(private readonly logger: MemoryFoundationLogger) {}

  initialize(storageRoot: string): string {
    this.memoryRoot = resolveStoragePath(storageRoot, "memory");
    this.registryDir = path.join(this.memoryRoot, "registry");
    this.backupsDir = path.join(this.memoryRoot, "backups");
    this.protectedDir = path.join(this.memoryRoot, "protected");

    const dirs = [
      this.memoryRoot,
      this.registryDir,
      this.backupsDir,
      this.protectedDir,
      ...PREPARED_MEMORY_CATEGORIES.map((c) => path.join(this.memoryRoot, c.subdirectory)),
      ...PROTECTED_DATA_CATEGORIES.map((c) => path.join(this.protectedDir, c)),
    ];

    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.logger.log("info", "startup", "Memory storage directories ensured", {
      memoryRoot: this.memoryRoot,
      categoryCount: PREPARED_MEMORY_CATEGORIES.length,
      protectedCount: PROTECTED_DATA_CATEGORIES.length,
    });

    return this.memoryRoot;
  }

  getMemoryRoot(): string {
    return this.memoryRoot;
  }

  getRegistryPath(): string {
    return path.join(this.registryDir, "memory-registry.json");
  }

  getCategoryPath(subdirectory: string): string {
    return path.join(this.memoryRoot, subdirectory);
  }

  getBackupsDir(): string {
    return this.backupsDir;
  }

  getProtectedDir(): string {
    return this.protectedDir;
  }

  verifyPersistence(): { passed: boolean; pathsVerified: number; detail: string } {
    const required = [
      this.memoryRoot,
      this.registryDir,
      this.backupsDir,
      ...PREPARED_MEMORY_CATEGORIES.map((c) => path.join(this.memoryRoot, c.subdirectory)),
    ];

    let verified = 0;
    for (const p of required) {
      if (fs.existsSync(p)) verified++;
    }

    const passed = verified === required.length;
    return {
      passed,
      pathsVerified: verified,
      detail: passed
        ? `All ${verified} memory paths persist on disk`
        : `${verified}/${required.length} paths verified`,
    };
  }

  writeCategoryData(subdirectory: string, filename: string, data: unknown): number {
    const start = Date.now();
    const filePath = path.join(this.getCategoryPath(subdirectory), filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return Date.now() - start;
  }

  readCategoryData<T>(subdirectory: string, filename: string): { data: T | null; durationMs: number } {
    const start = Date.now();
    const filePath = path.join(this.getCategoryPath(subdirectory), filename);
    if (!fs.existsSync(filePath)) {
      return { data: null, durationMs: Date.now() - start };
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return { data: JSON.parse(raw) as T, durationMs: Date.now() - start };
  }
}
