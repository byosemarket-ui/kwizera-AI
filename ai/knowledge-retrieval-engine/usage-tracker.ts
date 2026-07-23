import fs from "node:fs";
import path from "node:path";
import { KnowledgeUsageStat } from "./types.js";
import { KnowledgeRetrievalLogger } from "./retrieval-logger.js";

export class KnowledgeUsageTracker {
  private statsPath = "";
  private stats = new Map<string, KnowledgeUsageStat>();

  constructor(private readonly logger: KnowledgeRetrievalLogger) {}

  initialize(retrievalDir: string): void {
    fs.mkdirSync(retrievalDir, { recursive: true });
    this.statsPath = path.join(retrievalDir, "usage-stats.json");
    if (fs.existsSync(this.statsPath)) {
      const raw = fs.readFileSync(this.statsPath, "utf8");
      const data = JSON.parse(raw) as KnowledgeUsageStat[];
      for (const stat of data) {
        this.stats.set(stat.knowledgeId, stat);
      }
    }
  }

  recordAccess(knowledgeId: string): KnowledgeUsageStat {
    const existing = this.stats.get(knowledgeId);
    const stat: KnowledgeUsageStat = {
      knowledgeId,
      accessCount: (existing?.accessCount ?? 0) + 1,
      lastAccessTime: new Date().toISOString(),
    };
    this.stats.set(knowledgeId, stat);
    this.persist();
    return stat;
  }

  getStat(knowledgeId: string): KnowledgeUsageStat {
    return (
      this.stats.get(knowledgeId) ?? {
        knowledgeId,
        accessCount: 0,
        lastAccessTime: new Date(0).toISOString(),
      }
    );
  }

  getAllStats(): KnowledgeUsageStat[] {
    return [...this.stats.values()];
  }

  private persist(): void {
    fs.writeFileSync(this.statsPath, JSON.stringify([...this.stats.values()], null, 2), "utf8");
    void this.logger;
  }
}
