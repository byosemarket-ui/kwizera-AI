import fs from "node:fs";
import path from "node:path";
import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryStorageType } from "../memory-storage-engine/types.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryTier, MemoryTierAssignment } from "./types.js";

interface UsageStat {
  memoryId: string;
  accessCount: number;
  lastAccessTime: string;
}

const FREQUENT_ACCESS_THRESHOLD = 3;
const INACTIVE_DAYS = 90;

export class MemoryTierManager {
  private tiersPath = "";
  private assignments = new Map<string, MemoryTierAssignment>();

  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly storageRoot: string,
    private readonly logger: MemoryOptimizationLogger
  ) {}

  initialize(optimizationDir: string): void {
    this.tiersPath = path.join(optimizationDir, "tiers.json");
    if (fs.existsSync(this.tiersPath)) {
      const data = JSON.parse(fs.readFileSync(this.tiersPath, "utf8")) as MemoryTierAssignment[];
      for (const assignment of data) {
        this.assignments.set(assignment.memoryId, assignment);
      }
    }
  }

  classifyAll(): MemoryTierAssignment[] {
    const storage = this.foundation.getStorageEngine();
    const usageStats = this.loadUsageStats();
    const now = new Date().toISOString();

    for (const entry of storage.getIndexEntries()) {
      const usage = usageStats.get(entry.memoryId);
      const accessCount = usage?.accessCount ?? 0;
      const lastAccessTime = usage?.lastAccessTime ?? entry.lastUpdate;

      let tier = MemoryTier.Active;

      if (entry.memoryType === MemoryStorageType.System) {
        tier = MemoryTier.System;
      } else if (entry.memoryType === MemoryStorageType.Learning) {
        tier = MemoryTier.Learning;
      } else {
        const read = storage.findIndexEntry(entry.memoryId);
        const inactiveDays = this.daysSince(lastAccessTime);
        if (inactiveDays >= INACTIVE_DAYS) {
          tier = MemoryTier.Historical;
        } else if (accessCount >= FREQUENT_ACCESS_THRESHOLD) {
          tier = MemoryTier.FrequentlyUsed;
        }
      }

      const existing = this.assignments.get(entry.memoryId);
      if (existing?.tier === MemoryTier.Archived) {
        tier = MemoryTier.Archived;
      }

      this.assignments.set(entry.memoryId, {
        memoryId: entry.memoryId,
        memoryType: entry.memoryType,
        tier,
        accessCount,
        lastAccessTime,
        assignedAt: now,
      });
    }

    this.persist();
    return [...this.assignments.values()];
  }

  getTier(memoryId: string): MemoryTierAssignment | undefined {
    return this.assignments.get(memoryId);
  }

  getByTier(tier: MemoryTier): MemoryTierAssignment[] {
    return [...this.assignments.values()].filter((a) => a.tier === tier);
  }

  getDistribution(): Record<MemoryTier, number> {
    const dist: Record<MemoryTier, number> = {
      [MemoryTier.Active]: 0,
      [MemoryTier.FrequentlyUsed]: 0,
      [MemoryTier.Learning]: 0,
      [MemoryTier.Archived]: 0,
      [MemoryTier.Historical]: 0,
      [MemoryTier.System]: 0,
    };
    for (const assignment of this.assignments.values()) {
      dist[assignment.tier]++;
    }
    return dist;
  }

  markArchived(memoryId: string): void {
    const existing = this.assignments.get(memoryId);
    if (existing) {
      existing.tier = MemoryTier.Archived;
      existing.assignedAt = new Date().toISOString();
      this.persist();
    }
  }

  getTiersPath(): string {
    return this.tiersPath;
  }

  private loadUsageStats(): Map<string, UsageStat> {
    const statsPath = path.join(this.storageRoot, "memory", "retrieval", "usage-stats.json");
    const map = new Map<string, UsageStat>();
    if (!fs.existsSync(statsPath)) return map;

    const data = JSON.parse(fs.readFileSync(statsPath, "utf8")) as UsageStat[];
    for (const stat of data) {
      map.set(stat.memoryId, stat);
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
