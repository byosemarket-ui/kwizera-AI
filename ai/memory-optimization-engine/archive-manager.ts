import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryRecordStatus } from "../memory-storage-engine/types.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryTierManager } from "./memory-tier-manager.js";
import { ArchiveResult } from "./types.js";

const INACTIVE_DAYS = 90;
const MIN_QUALITY_TO_KEEP_ACTIVE = 30;

export class ArchiveManager {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly tierManager: MemoryTierManager,
    private readonly logger: MemoryOptimizationLogger
  ) {}

  async archiveInactive(): Promise<ArchiveResult> {
    const start = Date.now();
    const storage = this.foundation.getStorageEngine();
    const archived: string[] = [];

    for (const entry of storage.getIndexEntries()) {
      const read = await storage.getRecord(entry.memoryId);
      if (!read.success || !read.record) continue;
      if (read.record.status === MemoryRecordStatus.Archived) continue;

      const inactiveDays = this.daysSince(read.record.lastUpdate);
      if (inactiveDays >= INACTIVE_DAYS && read.record.qualityScore < MIN_QUALITY_TO_KEEP_ACTIVE) {
        const result = await storage.updateRecord(entry.memoryId, {
          status: MemoryRecordStatus.Archived,
          tags: [...read.record.tags, "auto-archived"],
        });

        if (result.success) {
          this.tierManager.markArchived(entry.memoryId);
          archived.push(entry.memoryId);
        }
      }
    }

    this.logger.log("info", "archive", "Archive operation complete", {
      archived: archived.length,
    });

    return { archived: archived.length, memoryIds: archived, durationMs: Date.now() - start };
  }

  private daysSince(isoDate: string): number {
    const diff = Date.now() - new Date(isoDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}
