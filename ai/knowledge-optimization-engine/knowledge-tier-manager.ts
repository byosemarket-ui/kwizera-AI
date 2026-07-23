import fs from "node:fs";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import {
  KnowledgeRecordStatus,
  KnowledgeStorageType,
} from "../knowledge-storage-engine/types.js";
import { KnowledgeOptimizationLogger } from "./optimization-logger.js";
import { KnowledgeTier, KnowledgeTierAssignment } from "./types.js";

interface UsageStat {
  knowledgeId: string;
  accessCount: number;
  lastAccessTime: string;
}

const FREQUENT_ACCESS_THRESHOLD = 3;
const INACTIVE_DAYS = 90;
const LOW_QUALITY_THRESHOLD = 50;

export class KnowledgeTierManager {
  private tiersPath = "";
  private assignments = new Map<string, KnowledgeTierAssignment>();

  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly storageRoot: string,
    private readonly logger: KnowledgeOptimizationLogger
  ) {}

  initialize(optimizationDir: string): void {
    this.tiersPath = path.join(optimizationDir, "tiers.json");
    if (fs.existsSync(this.tiersPath)) {
      const data = JSON.parse(fs.readFileSync(this.tiersPath, "utf8")) as KnowledgeTierAssignment[];
      for (const assignment of data) {
        this.assignments.set(assignment.knowledgeId, assignment);
      }
    }
  }

  classifyAll(): KnowledgeTierAssignment[] {
    const storage = this.foundation.getStorageEngine();
    const usageStats = this.loadUsageStats();
    const now = new Date().toISOString();

    for (const entry of storage.getIndexEntries()) {
      const usage = usageStats.get(entry.knowledgeId);
      const accessCount = usage?.accessCount ?? 0;
      const lastAccessTime = usage?.lastAccessTime ?? entry.lastUpdated;

      let tier = KnowledgeTier.Core;
      let qualityScore = 75;
      let confidenceScore = 75;

      const read = storage.findIndexEntry(entry.knowledgeId);
      if (read) {
        qualityScore = 75;
        confidenceScore = 75;
      }

      const existing = this.assignments.get(entry.knowledgeId);
      if (existing?.tier === KnowledgeTier.Archived) {
        tier = KnowledgeTier.Archived;
      } else {
        const inactiveDays = this.daysSince(lastAccessTime);
        if (inactiveDays >= INACTIVE_DAYS) {
          tier = KnowledgeTier.Historical;
        } else if (accessCount >= FREQUENT_ACCESS_THRESHOLD) {
          tier = KnowledgeTier.FrequentlyUsed;
        } else if (entry.knowledgeType === KnowledgeStorageType.Creative) {
          tier = KnowledgeTier.Creative;
        } else if (
          entry.knowledgeType === KnowledgeStorageType.Business ||
          entry.knowledgeType === KnowledgeStorageType.Marketing ||
          entry.knowledgeType === KnowledgeStorageType.Brand ||
          entry.knowledgeType === KnowledgeStorageType.Product
        ) {
          tier = KnowledgeTier.Business;
        } else if (entry.knowledgeType === KnowledgeStorageType.Industry) {
          tier = KnowledgeTier.Industry;
        } else if (qualityScore < LOW_QUALITY_THRESHOLD) {
          tier = KnowledgeTier.Experimental;
        }
      }

      this.assignments.set(entry.knowledgeId, {
        knowledgeId: entry.knowledgeId,
        knowledgeType: entry.knowledgeType,
        tier,
        accessCount,
        lastAccessTime,
        qualityScore,
        confidenceScore,
        assignedAt: now,
      });
    }

    this.persist();
    this.logger.log("info", "classification", "Knowledge tiers classified", {
      total: this.assignments.size,
    });

    return [...this.assignments.values()];
  }

  getTier(knowledgeId: string): KnowledgeTierAssignment | undefined {
    return this.assignments.get(knowledgeId);
  }

  getByTier(tier: KnowledgeTier): KnowledgeTierAssignment[] {
    return [...this.assignments.values()].filter((a) => a.tier === tier);
  }

  getDistribution(): Record<KnowledgeTier, number> {
    const dist: Record<KnowledgeTier, number> = {
      [KnowledgeTier.Core]: 0,
      [KnowledgeTier.FrequentlyUsed]: 0,
      [KnowledgeTier.Creative]: 0,
      [KnowledgeTier.Business]: 0,
      [KnowledgeTier.Industry]: 0,
      [KnowledgeTier.Archived]: 0,
      [KnowledgeTier.Historical]: 0,
      [KnowledgeTier.Experimental]: 0,
    };
    for (const assignment of this.assignments.values()) {
      dist[assignment.tier]++;
    }
    return dist;
  }

  markArchived(knowledgeId: string): void {
    const existing = this.assignments.get(knowledgeId);
    if (existing) {
      existing.tier = KnowledgeTier.Archived;
      existing.assignedAt = new Date().toISOString();
      this.persist();
    }
  }

  getTiersPath(): string {
    return this.tiersPath;
  }

  private loadUsageStats(): Map<string, UsageStat> {
    const statsPath = path.join(this.storageRoot, "knowledge", "retrieval", "usage-stats.json");
    const map = new Map<string, UsageStat>();
    if (!fs.existsSync(statsPath)) return map;

    const data = JSON.parse(fs.readFileSync(statsPath, "utf8")) as UsageStat[];
    for (const stat of data) {
      map.set(stat.knowledgeId, stat);
    }
    return map;
  }

  private daysSince(isoDate: string): number {
    const diff = Date.now() - new Date(isoDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private persist(): void {
    fs.writeFileSync(this.tiersPath, JSON.stringify([...this.assignments.values()], null, 2), "utf8");
  }
}
