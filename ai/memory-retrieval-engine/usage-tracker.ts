import fs from "node:fs";
import path from "node:path";
import { UsageStat } from "./types.js";
import { MemoryRetrievalLogger } from "./retrieval-logger.js";

export class UsageTracker {
  private statsPath = "";
  private stats = new Map<string, UsageStat>();

  constructor(private readonly logger: MemoryRetrievalLogger) {}

  initialize(retrievalDir: string): void {
    fs.mkdirSync(retrievalDir, { recursive: true });
    this.statsPath = path.join(retrievalDir, "usage-stats.json");
    if (fs.existsSync(this.statsPath)) {
      const raw = fs.readFileSync(this.statsPath, "utf8");
      const data = JSON.parse(raw) as UsageStat[];
      for (const stat of data) {
        this.stats.set(stat.memoryId, stat);
      }
    }
  }

  recordAccess(memoryId: string): UsageStat {
    const existing = this.stats.get(memoryId);
    const stat: UsageStat = {
      memoryId,
      accessCount: (existing?.accessCount ?? 0) + 1,
      lastAccessTime: new Date().toISOString(),
    };
    this.stats.set(memoryId, stat);
    this.persist();
    return stat;
  }

  getStat(memoryId: string): UsageStat {
    return (
      this.stats.get(memoryId) ?? {
        memoryId,
        accessCount: 0,
        lastAccessTime: new Date(0).toISOString(),
      }
    );
  }

  getAllStats(): UsageStat[] {
    return [...this.stats.values()];
  }

  private persist(): void {
    fs.writeFileSync(this.statsPath, JSON.stringify([...this.stats.values()], null, 2), "utf8");
  }
}
