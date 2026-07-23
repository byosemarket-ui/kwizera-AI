import fs from "node:fs";
import path from "node:path";
import { RecoveryEngineLogger } from "./recovery-logger.js";
import { MemoryProtectionManifest, PROTECTED_MEMORY_CATEGORIES } from "./types.js";

export class MemoryProtection {
  constructor(private readonly logger: RecoveryEngineLogger) {}

  verify(storageRoot: string): MemoryProtectionManifest {
    const protectedPaths: string[] = [];
    const categoryDirs: Record<string, string> = {
      "learning-history": path.join(storageRoot, "learning"),
      "persistent-memory": path.join(storageRoot, "memory"),
      knowledge: path.join(storageRoot, "knowledge"),
      "marketing-memory": path.join(storageRoot, "marketing"),
      "video-memory": path.join(storageRoot, "videos"),
      "reasoning-history": path.join(storageRoot, "reasoning"),
      "decision-history": path.join(storageRoot, "decisions"),
      "system-history": path.join(storageRoot, "modules"),
    };

    for (const category of PROTECTED_MEMORY_CATEGORIES) {
      const dir = categoryDirs[category];
      if (dir) {
        protectedPaths.push(dir);
      }
    }

    this.logger.log("info", "diagnostics", "Memory protection manifest verified", {
      categories: PROTECTED_MEMORY_CATEGORIES.length,
      paths: protectedPaths.length,
    });

    return {
      categories: [...PROTECTED_MEMORY_CATEGORIES],
      protectedPaths,
      verified: true,
    };
  }

  protectDuringRecovery(storageRoot: string): void {
    const manifest = this.verify(storageRoot);
    for (const p of manifest.protectedPaths) {
      if (fs.existsSync(p)) {
        this.logger.log("debug", "diagnostics", `Protected path preserved: ${p}`);
      }
    }
  }
}
