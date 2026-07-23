import type { AiMemoryFoundation } from "../memory-foundation/memory-foundation.js";
import { MemoryRecordStatus } from "../memory-storage-engine/types.js";
import { MemoryOptimizationLogger } from "./optimization-logger.js";
import { MemoryTierManager } from "./memory-tier-manager.js";
import { DuplicateGroup, DuplicateMergeResult } from "./types.js";

export class DuplicateMerger {
  constructor(
    private readonly foundation: AiMemoryFoundation,
    private readonly tierManager: MemoryTierManager,
    private readonly logger: MemoryOptimizationLogger
  ) {}

  detectDuplicates(): DuplicateGroup[] {
    const storage = this.foundation.getStorageEngine();
    const entries = storage.getIndexEntries();
    const groups = new Map<string, string[]>();

    for (const entry of entries) {
      const list = groups.get(entry.fingerprint) ?? [];
      list.push(entry.memoryId);
      groups.set(entry.fingerprint, list);
    }

    const duplicates: DuplicateGroup[] = [];

    for (const [fingerprint, memoryIds] of groups) {
      if (memoryIds.length < 2) continue;

      duplicates.push({
        fingerprint,
        memoryIds,
        primaryId: memoryIds[0],
        learningValue: memoryIds.length,
      });
    }

    this.logger.log("info", "duplicate", "Duplicate detection complete", {
      groups: duplicates.length,
    });

    return duplicates;
  }

  async mergeDuplicates(): Promise<DuplicateMergeResult> {
    const start = Date.now();
    const storage = this.foundation.getStorageEngine();
    const groups = this.detectDuplicates();
    const preserved: string[] = [];
    const archived: string[] = [];

    for (const group of groups) {
      preserved.push(group.primaryId);

      const scored = await Promise.all(
        group.memoryIds.map(async (id) => {
          const read = await storage.getRecord(id);
          return { id, quality: read.record?.qualityScore ?? 0 };
        })
      );
      scored.sort((a, b) => b.quality - a.quality);
      const primaryId = scored[0].id;

      for (const memoryId of group.memoryIds) {
        if (memoryId === primaryId) continue;

        const read = await storage.getRecord(memoryId);
        if (!read.success || !read.record) continue;

        const primaryRead = await storage.getRecord(primaryId);
        if (primaryRead.success && primaryRead.record) {
          const mergedTags = [...new Set([...primaryRead.record.tags, ...read.record.tags])];
          const mergedKeywords = [...new Set([...primaryRead.record.keywords, ...read.record.keywords])];

          await storage.updateRecord(primaryId, {
            tags: mergedTags,
            keywords: mergedKeywords,
            payload: {
              ...primaryRead.record.payload,
              mergedFrom: [...((primaryRead.record.payload?.mergedFrom as string[]) ?? []), memoryId],
            },
          });
        }

        await storage.updateRecord(memoryId, {
          status: MemoryRecordStatus.Archived,
          tags: [...read.record.tags, "merged-duplicate"],
        });

        this.tierManager.markArchived(memoryId);
        archived.push(memoryId);
      }
    }

    this.logger.log("info", "duplicate", "Duplicate merge complete", {
      merged: archived.length,
      preserved: preserved.length,
    });

    return {
      merged: archived.length,
      preserved,
      archived,
      durationMs: Date.now() - start,
    };
  }
}
